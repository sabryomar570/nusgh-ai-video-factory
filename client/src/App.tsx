import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { Route, Switch } from "wouter";

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Switch><Route path="/" component={Home} /><Route component={Home} /></Switch><Toaster richColors position="bottom-left" /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
