// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./WrappedEDGE.sol";

/**
 * @title EdgeAIBridge
 * @dev Bridge contract for transferring EDGE tokens between EdgeAI Chain and EVM chains
 * 
 * Architecture:
 * - EdgeAI Chain (Native EDGE) <-> Bridge Service <-> EVM Chain (wEDGE)
 * 
 * Flow:
 * 1. EdgeAI -> EVM: User locks EDGE on EdgeAI, bridge mints wEDGE on EVM
 * 2. EVM -> EdgeAI: User burns wEDGE on EVM, bridge releases EDGE on EdgeAI
 */
contract EdgeAIBridge is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // wEDGE token contract
    WrappedEDGE public immutable wEDGE;
    
    // Minimum and maximum bridge amounts
    uint256 public minBridgeAmount = 100 * 10**18; // 100 EDGE minimum
    uint256 public maxBridgeAmount = 10_000_000 * 10**18; // 10M EDGE maximum per tx
    
    // Bridge fee (in basis points, 100 = 1%)
    uint256 public bridgeFee = 10; // 0.1% fee
    uint256 public constant MAX_FEE = 500; // Max 5% fee
    
    // Fee recipient
    address public feeRecipient;
    
    // Nonce for preventing replay attacks
    mapping(bytes32 => bool) public processedHashes;
    
    // User bridge history
    struct BridgeRecord {
        address user;
        uint256 amount;
        uint256 fee;
        uint256 timestamp;
        string targetAddress;
        bool isIncoming; // true = EdgeAI->EVM, false = EVM->EdgeAI
    }
    
    BridgeRecord[] public bridgeHistory;
    mapping(address => uint256[]) public userBridgeIndices;
    
    // Statistics
    uint256 public totalBridgedToEVM;
    uint256 public totalBridgedToEdgeAI;
    uint256 public totalFeesCollected;
    
    // Events
    event BridgeToEVM(
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        string edgeaiTxHash,
        uint256 indexed recordIndex
    );
    
    event BridgeToEdgeAI(
        address indexed sender,
        uint256 amount,
        uint256 fee,
        string edgeaiAddress,
        uint256 indexed recordIndex
    );
    
    event BridgeFeeUpdated(uint256 oldFee, uint256 newFee);
    event BridgeLimitsUpdated(uint256 minAmount, uint256 maxAmount);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    /**
     * @dev Constructor
     * @param _wEDGE Address of the wEDGE token contract
     * @param _admin Admin address
     * @param _feeRecipient Address to receive bridge fees
     */
    constructor(
        address _wEDGE,
        address _admin,
        address _feeRecipient
    ) {
        require(_wEDGE != address(0), "Bridge: invalid wEDGE address");
        require(_admin != address(0), "Bridge: invalid admin address");
        require(_feeRecipient != address(0), "Bridge: invalid fee recipient");
        
        wEDGE = WrappedEDGE(_wEDGE);
        feeRecipient = _feeRecipient;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RELAYER_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }
    
    /**
     * @dev Process incoming bridge from EdgeAI Chain
     * Called by relayer when EDGE is locked on EdgeAI Chain
     * @param recipient EVM address to receive wEDGE
     * @param amount Amount of EDGE locked on EdgeAI (will mint same amount of wEDGE)
     * @param edgeaiTxHash Transaction hash on EdgeAI Chain
     */
    function processBridgeToEVM(
        address recipient,
        uint256 amount,
        string calldata edgeaiTxHash
    ) external onlyRole(RELAYER_ROLE) whenNotPaused nonReentrant {
        require(recipient != address(0), "Bridge: invalid recipient");
        require(amount >= minBridgeAmount, "Bridge: amount below minimum");
        require(amount <= maxBridgeAmount, "Bridge: amount exceeds maximum");
        
        // Check for replay attack
        bytes32 txHash = keccak256(abi.encodePacked(edgeaiTxHash));
        require(!processedHashes[txHash], "Bridge: transaction already processed");
        processedHashes[txHash] = true;
        
        // Calculate fee
        uint256 fee = (amount * bridgeFee) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Mint wEDGE to recipient
        wEDGE.bridgeIn(recipient, amountAfterFee, edgeaiTxHash);
        
        // Mint fee to fee recipient
        if (fee > 0) {
            wEDGE.bridgeIn(feeRecipient, fee, edgeaiTxHash);
            totalFeesCollected += fee;
        }
        
        // Record bridge
        uint256 recordIndex = bridgeHistory.length;
        bridgeHistory.push(BridgeRecord({
            user: recipient,
            amount: amountAfterFee,
            fee: fee,
            timestamp: block.timestamp,
            targetAddress: "",
            isIncoming: true
        }));
        userBridgeIndices[recipient].push(recordIndex);
        
        totalBridgedToEVM += amount;
        
        emit BridgeToEVM(recipient, amountAfterFee, fee, edgeaiTxHash, recordIndex);
    }
    
    /**
     * @dev Initiate bridge from EVM to EdgeAI Chain
     * Burns wEDGE and emits event for relayer to release EDGE on EdgeAI
     * @param amount Amount of wEDGE to bridge
     * @param edgeaiAddress Recipient address on EdgeAI Chain
     */
    function bridgeToEdgeAI(
        uint256 amount,
        string calldata edgeaiAddress
    ) external whenNotPaused nonReentrant {
        require(amount >= minBridgeAmount, "Bridge: amount below minimum");
        require(amount <= maxBridgeAmount, "Bridge: amount exceeds maximum");
        require(bytes(edgeaiAddress).length > 0, "Bridge: invalid EdgeAI address");
        
        // Calculate fee
        uint256 fee = (amount * bridgeFee) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Transfer fee to fee recipient
        if (fee > 0) {
            require(
                wEDGE.transferFrom(msg.sender, feeRecipient, fee),
                "Bridge: fee transfer failed"
            );
            totalFeesCollected += fee;
        }
        
        // Burn the rest (user must have approved this contract)
        // First transfer to this contract, then burn
        require(
            wEDGE.transferFrom(msg.sender, address(this), amountAfterFee),
            "Bridge: transfer failed"
        );
        wEDGE.burn(amountAfterFee);
        
        // Record bridge
        uint256 recordIndex = bridgeHistory.length;
        bridgeHistory.push(BridgeRecord({
            user: msg.sender,
            amount: amountAfterFee,
            fee: fee,
            timestamp: block.timestamp,
            targetAddress: edgeaiAddress,
            isIncoming: false
        }));
        userBridgeIndices[msg.sender].push(recordIndex);
        
        totalBridgedToEdgeAI += amount;
        
        emit BridgeToEdgeAI(msg.sender, amountAfterFee, fee, edgeaiAddress, recordIndex);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Update bridge fee
     * @param newFee New fee in basis points
     */
    function setBridgeFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_FEE, "Bridge: fee too high");
        uint256 oldFee = bridgeFee;
        bridgeFee = newFee;
        emit BridgeFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update bridge limits
     * @param _minAmount Minimum bridge amount
     * @param _maxAmount Maximum bridge amount
     */
    function setBridgeLimits(
        uint256 _minAmount,
        uint256 _maxAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minAmount < _maxAmount, "Bridge: invalid limits");
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        emit BridgeLimitsUpdated(_minAmount, _maxAmount);
    }
    
    /**
     * @dev Update fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Bridge: invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }
    
    /**
     * @dev Pause bridge operations
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause bridge operations
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get bridge statistics
     */
    function getBridgeStats() external view returns (
        uint256 _totalBridgedToEVM,
        uint256 _totalBridgedToEdgeAI,
        uint256 _totalFeesCollected,
        uint256 _totalRecords
    ) {
        return (
            totalBridgedToEVM,
            totalBridgedToEdgeAI,
            totalFeesCollected,
            bridgeHistory.length
        );
    }
    
    /**
     * @dev Get user's bridge history
     * @param user User address
     */
    function getUserBridgeHistory(address user) external view returns (uint256[] memory) {
        return userBridgeIndices[user];
    }
    
    /**
     * @dev Get bridge record by index
     * @param index Record index
     */
    function getBridgeRecord(uint256 index) external view returns (BridgeRecord memory) {
        require(index < bridgeHistory.length, "Bridge: invalid index");
        return bridgeHistory[index];
    }
    
    /**
     * @dev Calculate fee for a given amount
     * @param amount Amount to bridge
     */
    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * bridgeFee) / 10000;
    }
}
