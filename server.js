const app = require('./src/app');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const { dailySnapshotJob } = require('./jobs/dailySnapshot');


dotenv.config();

const PORT = process.env.PORT ||5000;

connectDB().then(() => {
    require('./jobs/notifications');
      dailySnapshotJob.start(); 
});


app.listen(PORT, () => {
    console.log(`Le serveur est lancé sur le port ${PORT}`);
});