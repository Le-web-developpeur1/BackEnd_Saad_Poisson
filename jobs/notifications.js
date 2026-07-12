const cron = require('node-cron');
const Notification = require('../src/models/Notification');

cron.schedule('* * * * *', async () => {
    try {
        const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
        const teenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        // Supprimer les notifications lues depuis plus d'1 minute
        const readDeleted = await Notification.deleteMany({
            isRead: true,
            readAt: { $lte: oneMinuteAgo }
        });
        
        // Supprimer les notifications non lues depuis plus de 10 minutes
        const unreadDeleted = await Notification.deleteMany({
            isRead: false,
            createdAt: { $lte: teenMinutesAgo }
        });
        
        const total = readDeleted.deletedCount + unreadDeleted.deletedCount;
        if (total > 0) {
            console.log(`[CRON] ${total} notifications supprimées (${readDeleted.deletedCount} lues, ${unreadDeleted.deletedCount} non lues)`);
        }
    } catch (error) {
        console.error('[CRON] Erreur suppression notifications:', error.message);
    }
});

console.log('[CRON] Job de nettoyage des notifications démarré');
