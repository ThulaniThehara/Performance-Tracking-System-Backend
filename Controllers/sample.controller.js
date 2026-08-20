const { sayHelloService, getStartedService } = require('../Services/sample.service');

const sayHello = async (req, res) => {
    try {
        const result = await sayHelloService();
        res.status(200).json({
            status: true,
            message: result
        });
    } catch (e) {
        res.status(500).json({
            status:false,
            message:e
        })
    }
}

const getStarted = async (req,res) => {
    try {
        const result = await getStartedService();
        res.status(200).json({
            status: true,
            message: result
        });
    } catch (e) {
        res.status(500).json({
            status:false,
            message:e
        })
    }
}

module.exports = {
    sayHello,
    getStarted
}