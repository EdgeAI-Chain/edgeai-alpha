const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  
  // Deploy WrappedEDGE
  console.log("\n1. Deploying WrappedEDGE (wEDGE)...");
  const WrappedEDGE = await hre.ethers.getContractFactory("WrappedEDGE");
  const wEDGE = await WrappedEDGE.deploy(deployer.address);
  await wEDGE.waitForDeployment();
  const wEDGEAddress = await wEDGE.getAddress();
  console.log("   WrappedEDGE deployed to:", wEDGEAddress);
  
  // Deploy EdgeAIBridge
  console.log("\n2. Deploying EdgeAIBridge...");
  const EdgeAIBridge = await hre.ethers.getContractFactory("EdgeAIBridge");
  const bridge = await EdgeAIBridge.deploy(
    wEDGEAddress,
    deployer.address, // admin
    deployer.address  // fee recipient (can be changed later)
  );
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log("   EdgeAIBridge deployed to:", bridgeAddress);
  
  // Grant BRIDGE_ROLE to the bridge contract
  console.log("\n3. Granting BRIDGE_ROLE to EdgeAIBridge...");
  const BRIDGE_ROLE = await wEDGE.BRIDGE_ROLE();
  await wEDGE.grantRole(BRIDGE_ROLE, bridgeAddress);
  console.log("   BRIDGE_ROLE granted to bridge contract");
  
  // Verify deployment
  console.log("\n4. Verifying deployment...");
  const bridgeStats = await bridge.getBridgeStats();
  console.log("   Bridge stats:", {
    totalBridgedToEVM: bridgeStats[0].toString(),
    totalBridgedToEdgeAI: bridgeStats[1].toString(),
    totalFeesCollected: bridgeStats[2].toString(),
    totalRecords: bridgeStats[3].toString()
  });
  
  const wEDGEStats = await wEDGE.getBridgeStats();
  console.log("   wEDGE stats:", {
    totalBridgedIn: wEDGEStats[0].toString(),
    totalBridgedOut: wEDGEStats[1].toString(),
    currentSupply: wEDGEStats[2].toString(),
    maxSupply: wEDGEStats[3].toString()
  });
  
  // Summary
  console.log("\n========================================");
  console.log("Deployment Summary");
  console.log("========================================");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("WrappedEDGE (wEDGE):", wEDGEAddress);
  console.log("EdgeAIBridge:", bridgeAddress);
  console.log("========================================");
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      WrappedEDGE: wEDGEAddress,
      EdgeAIBridge: bridgeAddress
    },
    timestamp: new Date().toISOString()
  };
  
  const fs = require("fs");
  const deploymentPath = `./deployments/${hre.network.name}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
