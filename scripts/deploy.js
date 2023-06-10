// imports
const { ethers, run, network } = require("hardhat")

// async main
async function main(params) {
    let ContractFactory

    ContractFactory = await ethers.getContractFactory(params.name)

    console.log("✨ All done !! ✨")
}

const verify = async (contractAddress, args) => {
    console.log("📝Verifying contract... 📝")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified!")
        } else {
            console.log(e)
        }
    }
}

const params = {
    name: "MultiSigWallet",
    address: "",
    args: [['addr1', 'addr2', 'addr3'], 2],
    verify: true,
}

main(params)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
