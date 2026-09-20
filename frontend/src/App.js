import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { TranslationProvider } from "@/context/TranslationContext";
import Console from "@/pages/Console";
import Debug from "@/pages/Debug";

function App() {
  return (
    <ThemeProvider>
      <TranslationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Console />} />
            <Route path="/debug" element={<Debug />} />
          </Routes>
        </BrowserRouter>
      </TranslationProvider>
    </ThemeProvider>
  );
}

export default App;
