// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WrappedEDGE (wEDGE)
 * @dev ERC-20 token representing EDGE tokens bridged from EdgeAI Chain
 * 
 * This token is minted when users bridge EDGE from EdgeAI Chain to EVM chains,
 * and burned when users bridge back to EdgeAI Chain.
 * 
 * Features:
 * - Mintable by bridge operators
 * - Burnable for bridge-back operations
 * - Pausable for emergency situations
 * - EIP-2612 Permit for gasless approvals
 */
contract WrappedEDGE is ERC20, ERC20Burnable, ERC20Permit, AccessControl, Pausable {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // EdgeAI Chain ID for cross-chain identification
    uint256 public constant EDGEAI_CHAIN_ID = 8888;
    
    // Maximum supply cap (matches EdgeAI total supply)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion wEDGE
    
    // Bridge statistics
    uint256 public totalBridgedIn;
    uint256 public totalBridgedOut;
    
    // Events
    event BridgedIn(address indexed to, uint256 amount, string edgeaiTxHash);
    event BridgedOut(address indexed from, uint256 amount, string edgeaiAddress);
    event BridgeOperatorAdded(address indexed operator);
    event BridgeOperatorRemoved(address indexed operator);
    
    /**
     * @dev Constructor
     * @param admin Address that will have admin role
     */
    constructor(address admin) 
        ERC20("Wrapped EDGE", "wEDGE") 
        ERC20Permit("Wrapped EDGE") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BRIDGE_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }
    
    /**
     * @dev Mint wEDGE tokens when bridging from EdgeAI Chain
     * @param to Recipient address on EVM chain
     * @param amount Amount of wEDGE to mint (18 decimals)
     * @param edgeaiTxHash Transaction hash on EdgeAI Chain for verification
     */
    function bridgeIn(
        address to, 
        uint256 amount, 
        string calldata edgeaiTxHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(to != address(0), "wEDGE: mint to zero address");
        require(amount > 0, "wEDGE: amount must be positive");
        require(totalSupply() + amount <= MAX_SUPPLY, "wEDGE: exceeds max supply");
        
        _mint(to, amount);
        totalBridgedIn += amount;
        
        emit BridgedIn(to, amount, edgeaiTxHash);
    }
    
    /**
     * @dev Burn wEDGE tokens when bridging back to EdgeAI Chain
     * @param amount Amount of wEDGE to burn
     * @param edgeaiAddress Recipient address on EdgeAI Chain
     */
    function bridgeOut(
        uint256 amount, 
        string calldata edgeaiAddress
    ) external whenNotPaused {
        require(amount > 0, "wEDGE: amount must be positive");
        require(bytes(edgeaiAddress).length > 0, "wEDGE: invalid EdgeAI address");
        
        _burn(msg.sender, amount);
        totalBridgedOut += amount;
        
        emit BridgedOut(msg.sender, amount, edgeaiAddress);
    }
    
    /**
     * @dev Add a bridge operator
     * @param operator Address to grant bridge role
     */
    function addBridgeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BRIDGE_ROLE, operator);
        emit BridgeOperatorAdded(operator);
    }
    
    /**
     * @dev Remove a bridge operator
     * @param operator Address to revoke bridge role
     */
    function removeBridgeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(BRIDGE_ROLE, operator);
        emit BridgeOperatorRemoved(operator);
    }
    
    /**
     * @dev Pause all bridge operations
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
    
    /**
     * @dev Get bridge statistics
     */
    function getBridgeStats() external view returns (
        uint256 _totalBridgedIn,
        uint256 _totalBridgedOut,
        uint256 _currentSupply,
        uint256 _maxSupply
    ) {
        return (totalBridgedIn, totalBridgedOut, totalSupply(), MAX_SUPPLY);
    }
    
    /**
     * @dev Returns the number of decimals (18, same as ETH)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
