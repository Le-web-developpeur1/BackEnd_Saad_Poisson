const cron = require('node-cron');
const { createOrUpdateDailySnapshot } = require('../src/controllers/reportController');
const DailySnapshot = require('../src/models/DailySnapshot');

// Chaque jour à minuit (00:00)
const dailySnapshotJob = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('─────────────────────────────────────────────────');
    console.log('[SNAPSHOT-CRON] Tâche quotidienne démarrée');
    console.log('─────────────────────────────────────────────────');

    // 1️⃣ FINALISER le snapshot d'HIER
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const finalizedSnapshot = await DailySnapshot.findOneAndUpdate(
      { date: yesterday },
      { isFinalized: true },
      { returnDocument: 'after' }
    );

    if (finalizedSnapshot) {
      console.log(`✅ [SNAPSHOT-CRON] Snapshot du ${yesterday.toLocaleDateString('fr-FR')} finalisé`);
      console.log(`   - Total ventes: ${finalizedSnapshot.totalSales.toLocaleString('fr-FR')} GNF`);
      console.log(`   - Total encaissé: ${finalizedSnapshot.totalEncaisse.toLocaleString('fr-FR')} GNF`);
    } else {
      console.log(`⚠️  [SNAPSHOT-CRON] Aucun snapshot trouvé pour ${yesterday.toLocaleDateString('fr-FR')}`);
    }

    // 2️⃣ CRÉER un snapshot initial pour AUJOURD'HUI
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySnapshot = await createOrUpdateDailySnapshot(today);
    
    console.log(`✅ [SNAPSHOT-CRON] Snapshot du ${today.toLocaleDateString('fr-FR')} créé`);
    console.log(`   - ID: ${todaySnapshot._id}`);
    console.log('─────────────────────────────────────────────────');
  } catch (error) {
    console.error('❌ [SNAPSHOT-CRON] Erreur:', error.message);
    console.error(error.stack);
  }
});

module.exports = { dailySnapshotJob };
