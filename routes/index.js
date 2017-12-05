const config = require('config');
const express = require('express');
const AfricasTalking = require('africastalking')(config.get('africastalking'));

const router = express.Router();
const sms = AfricasTalking.SMS;
const payments = AfricasTalking.PAYMENTS;
const airtime = AfricasTalking.AIRTIME;

const statuses = [
    'Paid; will be shipped shortly',
    'Paid; waiting for boda boda shipping',
    'Shipped; currently in Thika',
    'Shipped; currently in Kileleshwa',
    'Failed to deliver to your village. Contact support +254718769882',
    'Delivered',
];
const orders = {};

/* GET home page. */
router.get('/', (req, res) => {
    res.render('index', { title: 'IoT Store' });
});

router.post('/checkout/:action(request|confirm)', async (req, res, next) => {
    const data = req.body;
    switch (req.params.action) {
    case 'request':
        // send sms verification code
        try {
            if (!/^2547/.test(data.phone)) {
                res.status(400).send({
                    message: 'Invalid phone number',
                });
                return;
            }
            data.transaction = `${Math.floor((Math.random() * 9999) + 5999)}`;
            data.otp = `${Math.floor((Math.random() * 5000) + 1000)}`;
            data.status = 'Unverified';
            orders[data.transaction] = data;
            await sms.send({
                to: data.phone,
                from: config.get('africastalking.senderId'),
                message: `Kindly confirm your IoT Store order #${data.transaction} with the following code:\n${data.otp}`,
            });
            // FIXME: handle response from SMS
            res.send({
                transaction: data.transaction,
                message: `Kindly confirm your order #${data.transaction}`,
            });
        } catch (ex) {
            res.status(500).send({ message: ex.message || 'Something blew up while confirming order :(' });
        }
        break;

    case 'confirm':
        // initiate mpesa checkout
        try {
            const order = orders[data.transaction];
            if (!order || order.otp !== data.code) {
                res.status(400).send({ message: 'Invalid or expired order!' });
                return;
            }

            await payments.mobileCheckout({
                productName: config.get('africastalking.payments.product'),
                phoneNumber: order.phone,
                currencyCode: order.currency,
                amount: parseFloat(order.amount),
                metadata: order,
            });
            // FIXME: Check the response from the API

            orders[data.transaction].status = 'Awaiting Payment';

            res.send({
                message: `Thank you for shopping with us. Checkout your phone to complete payment. Dial ${config.get('africastalking.ussd')} to track your order #${order.transaction}`,
            });
        } catch (ex) {
            res.status(500).send({ message: ex.message || 'Something blew up while verifying order :(' });
        }
        break;
    default:
        next();
        break;
    }
});

router.post('/dlr', async (req, res) => {
    res.send('OK');
});

router.post('/ipn', async (req, res) => {
    const data = req.body;
    const order = orders[data.requestMetadata.transaction];
    if (order) {
        const paymentValue = parseFloat(data.value.replace(/^[a-zA-Z]{3} /, ''));
        if (paymentValue < parseFloat(order.amount)) {
            orders[data.requestMetadata.transaction].status = 'Not Fully Paid! Contact support +254718769882';
        } else {
            orders[data.requestMetadata.transaction].status = `${statuses[Math.floor(Math.random() * statuses.length)]}`;
            // send airtime
            airtime.send({ recipients: [{ phoneNumber: order.phone, amount: 'KES 10' }] });
        }
    }
    res.send('OK');
});

router.post('/ussd', new AfricasTalking.USSD((params, next) => {
    let response = '';
    let endSession = false;

    switch (params.text) {
    case '':
        response = 'Welcome to IoT Store \n\n';
        response += '1. Order Status \n';
        response += '2. Quit\n';
        endSession = false;
        break;
    case '1':
        response = 'Enter Order Number e.g. 234\n\n';
        endSession = false;
        break;
    case '2':
        response = 'Thank you for shopping on IoT Store';
        endSession = true;
        break;
    default:
        if (/^1\*(.+)/.test(params.text)) {
            const id = params.text.replace(/^1\*/, '');
            const order = orders[id];
            if (order) {
                response = `Your order status is: ${order.status}`;
            } else {
                response = 'Invalid or expired order';
            }
        } else {
            response = 'Invalid option';
        }
        endSession = true;
    }

    next({
        response,
        endSession,
    });
}));

module.exports = router;
