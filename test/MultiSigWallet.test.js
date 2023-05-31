const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("MultiSigWallet", function () {
    let multiSigWallet, MultiSigWalletContract
    let owner1, owner2, owner3
    let addr1

    beforeEach(async function () {
        [owner1, owner2, owner3, addr1] =
            await ethers.getSigners()
        const owners = [owner1.address, owner2.address, owner3.address]
        const numConfirmationsRequired = 2

        MultiSigWalletContract = await ethers.getContractFactory(
            "MultiSigWallet"
        )
        multiSigWallet = await MultiSigWalletContract.deploy(
            owners,
            numConfirmationsRequired
        )
        await multiSigWallet.deployed()
    })

    describe("Deployment", function () {
        it("Should set the correct owners and confirmation requirement", async function () {
            expect(await multiSigWallet.getOwners()).to.have.members([
                owner1.address,
                owner2.address,
                owner3.address,
            ])
            expect(await multiSigWallet.numConfirmationsRequired()).to.equal(2)
        })

        it("Should reject deployment with no owners", async function () {
            const owners = [];
            const numConfirmationsRequired = 2;
            const MultiSigWallet = await ethers.getContractFactory(
                "MultiSigWallet"
            )

            await expect(
                MultiSigWallet.deploy(owners, numConfirmationsRequired)
            ).to.be.revertedWith("owners required");
        });

        it("Should reject deployment with invalid number of required confirmations", async function () {
            const owners = [owner1.address, owner2.address, owner3.address];
            const numConfirmationsRequired = 0;
            const MultiSigWallet = await ethers.getContractFactory(
                "MultiSigWallet"
            )
            await expect(
                MultiSigWallet.deploy(owners, numConfirmationsRequired)
            ).to.be.revertedWith("invalid number of required confirmations");

            const invalidNumConfirmations = owners.length + 1;

            await expect(
                MultiSigWallet.deploy(owners, invalidNumConfirmations)
            ).to.be.revertedWith("invalid number of required confirmations");
        });

        it("Should reject deployment with invalid owner addresses", async function () {
            const owners = [owner1.address, ethers.constants.AddressZero, owner3.address];
            const numConfirmationsRequired = 2;
            const MultiSigWallet = await ethers.getContractFactory(
                "MultiSigWallet"
            )
            await expect(
                MultiSigWallet.deploy(owners, numConfirmationsRequired)
            ).to.be.revertedWith("invalid owner");

            const duplicateOwner = owner1.address;

            await expect(
                MultiSigWallet.deploy([duplicateOwner, duplicateOwner], numConfirmationsRequired)
            ).to.be.revertedWith("owner not unique");
        });
    })

    describe("Authorized actions", function () {
        it("Should owner to submit a transaction", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()
            const transaction = await multiSigWallet.getTransaction(0)
            expect(transactionCount).to.equal(1)
            expect(transaction.to).to.equal(addr1.address)
            expect(transaction.value).to.equal(value)
            expect(transaction.data).to.equal(data)
            expect(transaction.executed).to.be.false
            expect(transaction.numConfirmations).to.equal(0)
        })

        it("Should allow submitting and executing a transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)

            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)

            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            const executedTransaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(executedTransaction.executed).to.be.true
        })

        it("Should allow an owner to revoke their confirmation", async function () {
            let transaction
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.numConfirmations).to.equal(1)

            await multiSigWallet
                .connect(owner1)
                .revokeConfirmation(transactionCount - 1)
            transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.numConfirmations).to.equal(0)
        })

        it("Should allow an owner to submit and execute multiple transactions", async function () {
            const to = addr1.address
            const data = "0x"

            // First transaction
            await multiSigWallet.submitTransaction(to, 0, data)
            let transactionCount = await multiSigWallet.getTransactionCount()
            let transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.executed).to.be.false

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.executed).to.be.true

            // Second transaction
            await multiSigWallet.submitTransaction(to, 0, data)
            transactionCount = await multiSigWallet.getTransactionCount()
            transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.executed).to.be.false

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.executed).to.be.true
        })

        it("Should increase the contract balance when receiving funds", async function () {
            const initialBalance = await ethers.provider.getBalance(
                multiSigWallet.address
            )
            const depositAmount = ethers.utils.parseEther("1.0")

            await addr1.sendTransaction({
                to: multiSigWallet.address,
                value: depositAmount,
            })

            const newBalance = await ethers.provider.getBalance(
                multiSigWallet.address
            )
            expect(newBalance).to.equal(initialBalance.add(depositAmount))
        })

        it("Should allow an owner to transfer funds to the contract and submit a transaction to send them to another address", async function () {
            const initialOwnerBalance = await ethers.provider.getBalance(
                owner1.address
            )
            const initialToBalance = await ethers.provider.getBalance(
                addr1.address
            )
            const transferAmount = ethers.utils.parseEther("1.0")

            // Transfer funds to the contract
            await owner1.sendTransaction({
                to: multiSigWallet.address,
                value: transferAmount,
            })

            // Check the contract balance
            const contractBalance = await ethers.provider.getBalance(
                multiSigWallet.address
            )
            expect(contractBalance).to.equal(transferAmount)

            // Submit a transaction to send the funds to another address
            const to = addr1.address
            const data = "0x"
            await multiSigWallet.submitTransaction(to, transferAmount, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            // // Confirm the transaction
            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)

            // // Execute the transaction
            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            // // Check the updated contract balance
            const updatedContractBalance = await ethers.provider.getBalance(
                multiSigWallet.address
            )
            expect(updatedContractBalance).to.equal(0)

            // Check the recipient balance
            const recipientBalance = await ethers.provider.getBalance(to)
            expect(recipientBalance).to.equal(
                initialToBalance.add(transferAmount)
            )

            // Check the owner balance
            const finalOwnerBalance = await ethers.provider.getBalance(
                owner1.address
            )

            expect(finalOwnerBalance.lt(initialOwnerBalance)).to.be.true
        })
    })

    describe("Not authorized actions", function () {
        it("Should not allow a non-owner to submit a transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await expect(
                multiSigWallet.connect(addr1).submitTransaction(to, 0, data)
            ).to.be.revertedWith("not owner")
        })

        it("Should not allow confirming an already executed transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner2)
                    .confirmTransaction(transactionCount - 1)
            ).to.be.revertedWith("tx already executed")
        })

        it("Should not allow confirming an already confirmed transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .confirmTransaction(transactionCount - 1)
            ).to.be.revertedWith("tx already confirmed")
        })

        it("Should not allow executing a transaction without enough confirmations", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .executeTransaction(transactionCount - 1)
            ).to.be.revertedWith("cannot execute tx")
        })

        it("Should not allow revoking confirmation for an already executed transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .revokeConfirmation(transactionCount - 1)
            ).to.be.revertedWith("tx already executed")
        })

        it("Should not allow executing a transaction with insufficient balance", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("1")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .executeTransaction(transactionCount - 1)
            ).to.be.revertedWith("tx failed")
        })

        it("Should not allow confirming a non-existing transaction", async function () {
            await expect(
                multiSigWallet.connect(owner1).confirmTransaction(999)
            ).to.be.revertedWith("tx does not exist")
        })

        it("Should not allow confirming an already executed transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)

            await multiSigWallet
                .connect(owner1)
                .executeTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner2)
                    .confirmTransaction(transactionCount - 1)
            ).to.be.revertedWith("tx already executed")
        })

        it("Should not allow executing a non-existing transaction", async function () {
            await expect(
                multiSigWallet.connect(owner1).executeTransaction(999)
            ).to.be.revertedWith("tx does not exist")
        })

        it("Should not allow revoking a non-existing transaction", async function () {
            await expect(
                multiSigWallet.connect(owner1).revokeConfirmation(999)
            ).to.be.revertedWith("tx does not exist")
        })

        it("Should not allow revoking a non-confirmed transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .revokeConfirmation(transactionCount - 1)
            ).to.be.revertedWith("tx not confirmed")
        })
    })

    describe("Events", function () {
        it("Should emit SubmitTransaction event when submitting a transaction", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await expect(multiSigWallet.submitTransaction(to, value, data))
                .to.emit(multiSigWallet, "SubmitTransaction")
                .withArgs(owner1.address, 0, to, value, data)
        })

        it("Should emit ConfirmTransaction event when confirming a transaction", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .confirmTransaction(transactionCount - 1)
            )
                .to.emit(multiSigWallet, "ConfirmTransaction")
                .withArgs(owner1.address, transactionCount - 1)
        })

        it("Should emit RevokeConfirmation event when revoking a transaction confirmation", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .revokeConfirmation(transactionCount - 1)
            )
                .to.emit(multiSigWallet, "RevokeConfirmation")
                .withArgs(owner1.address, transactionCount - 1)
        })

        it("Should emit ExecuteTransaction event when executing a transaction", async function () {
            const to = addr1.address
            const data = "0x"

            await multiSigWallet.submitTransaction(to, 0, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            await multiSigWallet
                .connect(owner1)
                .confirmTransaction(transactionCount - 1)
            await multiSigWallet
                .connect(owner2)
                .confirmTransaction(transactionCount - 1)

            await expect(
                multiSigWallet
                    .connect(owner1)
                    .executeTransaction(transactionCount - 1)
            )
                .to.emit(multiSigWallet, "ExecuteTransaction")
                .withArgs(owner1.address, transactionCount - 1)
        })

        it("Should emit Deposit event when receiving funds", async function () {
            const depositAmount = ethers.utils.parseEther("1.0")

            await expect(
                addr1.sendTransaction({
                    to: multiSigWallet.address,
                    value: depositAmount,
                })
            )
                .to.emit(multiSigWallet, "Deposit")
                .withArgs(addr1.address, depositAmount, depositAmount)
        })
    })
    describe("View functions", function () {
        it("Should return correct transaction details", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()

            const transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )
            expect(transaction.to).to.equal(to)
            expect(transaction.value).to.equal(value)
            expect(transaction.data).to.equal(data)
            expect(transaction.executed).to.be.false
            expect(transaction.numConfirmations).to.equal(0)
        })

        it("Should return the correct owners", async function () {
            const returnedOwners = await multiSigWallet.getOwners()
            expect(returnedOwners).to.have.members([
                owner1.address,
                owner2.address,
                owner3.address,
            ])
        })

        it("Should return the correct transaction count", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()
            expect(transactionCount).to.equal(1)
        })

        it("Should return the correct transaction details", async function () {
            const to = addr1.address
            const value = ethers.utils.parseEther("0.5")
            const data = "0x"

            await multiSigWallet.submitTransaction(to, value, data)
            const transactionCount = await multiSigWallet.getTransactionCount()
            const transaction = await multiSigWallet.getTransaction(
                transactionCount - 1
            )

            expect(transaction.to).to.equal(to)
            expect(transaction.value).to.equal(value)
            expect(transaction.data).to.equal(data)
            expect(transaction.executed).to.be.false
            expect(transaction.numConfirmations).to.equal(0)
        })
    })
})