import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { StudioProvider } from "@/context/StudioContext";
import Home from "@/pages/Home";
import Analyze from "@/pages/Analyze";
import Research from "@/pages/Research";
import Compose from "@/pages/Compose";
import Studio from "@/pages/Studio";
import History from "@/pages/History";
import Calendar from "@/pages/Calendar";

function App() {
  return (
    <div className="App">
      <StudioProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/research" element={<Research />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/history" element={<History />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/studio" element={<Studio />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </StudioProvider>
    </div>
  );
}

export default App;
