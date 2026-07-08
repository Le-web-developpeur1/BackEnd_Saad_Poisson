const cron = require('node-cron');
const Notification = require('../src/models/Notification');

cron.schedule('* * * * *', async () => {
    const tenMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);
    await Notification.deleteMany({
        isRead: true,
        readAt: { $lte: tenMinutesAgo}
    });
});