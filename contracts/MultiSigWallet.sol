// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title Multi-Signature Wallet
/// @notice A smart contract that implements a multi-signature wallet
contract MultiSigWallet {
    event Deposit(address indexed sender, uint amount, uint balance);
    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    // mapping from tx index => owner => bool
    mapping(uint => mapping(address => bool)) public isConfirmed;

    Transaction[] public transactions;

    /// @dev Modifier to restrict access to only the contract owners
    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    /// @dev Modifier to check if a transaction with the given index exists
    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    /// @dev Modifier to check if a transaction with the given index is not yet executed
    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    /// @dev Modifier to check if the message sender has not yet confirmed the given transaction index
    modifier notConfirmed(uint _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "tx already confirmed");
        _;
    }

    /// @notice Constructs a new MultiSigWallet contract with the specified owners and required confirmations
    /// @param _owners The addresses of the owners of the wallet
    /// @param _numConfirmationsRequired The number of confirmations required for executing a transaction
    constructor(address[] memory _owners, uint _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /// @notice Fallback function to receive Ether and emit a deposit event
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Submits a new transaction to the contract
    /// @param _to The address to which the transaction is sent
    /// @param _value The amount of Ether to send in the transaction
    /// @param _data The transaction data
    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwner {
        uint txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data:

 _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /// @notice Confirms a transaction by the message sender
    /// @param _txIndex The index of the transaction to confirm
    function confirmTransaction(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) notConfirmed(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /// @notice Executes a confirmed transaction
    /// @param _txIndex The index of the transaction to execute
    function executeTransaction(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /// @notice Revokes a previously confirmed transaction
    /// @param _txIndex The index of the transaction to revoke confirmation from
    function revokeConfirmation(
        uint _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /// @notice Retrieves the addresses of the owners of the wallet
    /// @return An array of owner addresses
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    /// @notice Retrieves the total number of transactions in the contract
    /// @return The count of transactions
    function getTransactionCount() public view returns (uint) {
        return transactions.length;
    }

    /// @notice Retrieves the details of a specific transaction
    /// @param _txIndex The index of the transaction to retrieve
    /// @return to The address to which the transaction is sent
    /// @return value The amount of Ether to send in the transaction
    /// @return data The transaction data
    /// @return executed Indicates if the transaction has been executed
    /// @return numConfirmations The number of confirmations the transaction has
    function getTransaction(
        uint _txIndex
    )
        public
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
