// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {FlareToken} from "../src/FlareToken.sol";
import {FlareVault} from "../src/FlareVault.sol";
import {FlareExecutor} from "../src/FlareExecutor.sol";
import {FlareFactory} from "../src/FlareFactory.sol";

contract Deploy is Script {
    function run() external returns (FlareToken token, FlareVault vault, FlareExecutor executor, FlareFactory factory) {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        vm.startBroadcast(key);
        token = new FlareToken(deployer);
        vault = new FlareVault(deployer);
        executor = new FlareExecutor(deployer,address(vault));
        factory = new FlareFactory(address(executor));
        vault.setExecutor(address(executor), true);
        vm.stopBroadcast();
    }
}
