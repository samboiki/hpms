import React from "react";
import { motion } from "framer-motion";

const BrokenComponent = () => {
  return (
    <div>
      <motion.div>
        <h1>Title</h1>
        <p>This paragraph is fine</p>
        <span>This span is missing its closing tag</span>
      </motion.div>
      <div>
        <button>Click me</button>
      </div>
    </div>
  );
};

export default BrokenComponent;
