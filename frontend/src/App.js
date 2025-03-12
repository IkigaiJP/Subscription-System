import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SubscriptionApp from "./components/SubscriptionApp";

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<SubscriptionApp />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
