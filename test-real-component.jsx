import React from 'react';
import { motion } from 'framer-motion';

const AddVisitTabs = () => {
  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="header">
          <h1>Visit Details</h1>
        </div>
        
        <div className="content">
          <motion.div className="card">
            <h2>Patient Info</h2>
            <div className="patient-details">
              <span>Name: John Doe
              <span>Age: 45</span>
            </div>
          </motion.div>
          
          <div className="actions">
            <button>Save</button>
            <button>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AddVisitTabs;
