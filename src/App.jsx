import { useEffect } from "react";
import Editor from "./editor.jsx";
import { initFontToolbar } from "./fonte.js";

function App() {
  useEffect(() => {
    initFontToolbar();
  }, []);

  return (
    <>
      <Editor />
    </>
  );
}

export default App;