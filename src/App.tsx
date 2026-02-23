/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapPage from './components/MapPage';
import ConfigurePage from './components/ConfigurePage';

export default function App() {
  return (
    <div className="app-container">
      <Router>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/configurelocation" element={<ConfigurePage />} />
        </Routes>
      </Router>
    </div>
  );
}
