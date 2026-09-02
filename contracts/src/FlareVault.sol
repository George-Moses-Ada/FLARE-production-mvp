// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FlareVault is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public authorizedExecutors;
    mapping(address => mapping(address => uint256)) public reserved;

    event ExecutorAuthorization(address indexed executor, bool allowed);
    event Funded(address indexed token, address indexed from, uint256 amount);
    event Released(address indexed token, address indexed recipient, uint256 amount);

    constructor(address owner_) Ownable(owner_) {}

    modifier onlyExecutor() {
        require(authorizedExecutors[msg.sender], "NOT_EXECUTOR");
        _;
    }

    function setExecutor(address executor, bool allowed) external onlyOwner {
        authorizedExecutors[executor] = allowed;
        emit ExecutorAuthorization(executor, allowed);
    }

    function fund(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(token,msg.sender,amount);
    }

    function release(address token, address recipient, uint256 amount) external onlyExecutor {
        require(recipient != address(0), "ZERO_RECIPIENT");
        require(amount > 0, "ZERO_AMOUNT");
        IERC20(token).safeTransfer(recipient, amount);
        emit Released(token,recipient,amount);
    }

    function balance(address token) external view returns(uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
