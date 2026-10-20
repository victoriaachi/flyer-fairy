import { useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/App.css";
import "./styles/global.css";
import Test from "./pages/Test";
import Home from "./pages/Home";
import Flyers from "./pages/Flyers";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />}></Route>
        <Route path="/test" element={<Test />}></Route>
        <Route path="/flyers" element={<Flyers />}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
