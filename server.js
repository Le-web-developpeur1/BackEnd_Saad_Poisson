const app = require('./src/app');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();

const PORT = process.env.PORT ||5000;

connectDB();

require('./jobs/notifications');

app.listen(PORT, () => {
    console.log(`Le serveur est lancé sur le port ${PORT}`);
});