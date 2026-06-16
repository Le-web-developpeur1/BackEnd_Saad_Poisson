const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  phone:    { type: String, trim: true },
  position: { type: String, required: true, trim: true },
  salaryType: {
    type: String,
    enum: ['mensuel', 'journalier'],
    default: 'mensuel'
  },
  monthlySalary: { type: Number, default: 0 }, // si mensuel
  dailyRate:     { type: Number, default: 0 }, // si journalier
  hireDate:  { type: Date, default: Date.now },
  isActive:  { type: Boolean, default: true },
  notes:     { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);