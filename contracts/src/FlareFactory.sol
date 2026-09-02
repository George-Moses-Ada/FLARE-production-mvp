// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FlareExecutor} from "./FlareExecutor.sol";

contract FlareFactory {
    FlareExecutor public immutable executor;
    mapping(address => bool) public flareOf;
    address[] public allFlares;

    event FlareCreated(
        address indexed flare,
        address indexed creator,
        address indexed token,
        uint256 targetHolders,
        address recipient,
        uint256 amount
    );

    constructor(address executor_) {
        executor = FlareExecutor(executor_);
    }

    function createFlare(
        address token,
        uint256 targetHolders,
        address recipient,
        uint256 amount,
        uint64 expiresAt
    ) external returns(address flare) {
        require(token != address(0) && recipient != address(0), "BAD_ADDRESS");
        require(targetHolders > 0 && amount > 0, "BAD_CONFIG");
        bytes32 salt = keccak256(abi.encode(msg.sender, token, targetHolders, recipient, amount, expiresAt, allFlares.length));
        flare = address(uint160(uint256(keccak256(abi.encodePacked(address(this), salt)))));
        require(!flareOf[flare], "COLLISION");
        flareOf[flare] = true;
        allFlares.push(flare);
        executor.configure(flare,msg.sender,token,targetHolders,recipient,amount,expiresAt);
        emit FlareCreated(flare,msg.sender,token,targetHolders,recipient,amount);
    }

    function count() external view returns(uint256){ return allFlares.length; }
}
