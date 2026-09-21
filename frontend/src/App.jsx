import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { TranslationProvider } from "@/context/TranslationContext";
import Console from "@/pages/Console";
import Debug from "@/pages/Debug";
import Listener from "@/pages/Listener";
import OperatorAccess from "@/components/OperatorAccess";
import LoadTest from "@/pages/LoadTest";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
          <Routes>
            <Route path="/e/:id" element={<Listener />} />
            <Route element={<OperatorAccess><TranslationProvider><Outlet /></TranslationProvider></OperatorAccess>}>
              <Route path="/" element={<Console />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/loadtest" element={<LoadTest />} />
            </Route>
            <Route path="*" element={<p className="p-8">Page not found. <a href="/">Open TranslateBox</a></p>} />
          </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
