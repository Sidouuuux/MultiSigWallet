// imports
const { ethers, run, network } = require("hardhat")

// async main
async function main(params) {
    let ContractFactory
    let contractUSDT
    let contractUSDC
    let contractBUSD

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
    name: "Netflix",
    address: "",
    args: [],
    verify: true,
}

main(params)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
