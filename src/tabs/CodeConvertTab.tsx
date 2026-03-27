import { useState } from "react";
import { useConnection } from "../App";
import {
  CodeConvertPanel,
  checkSourceCode,
  convertSourceCode,
  copyConvertedCode,
} from "../features/code-convert/index";

export default function CodeConvertTab() {
  const { appendLog } = useConnection();
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");

  return (
    <CodeConvertPanel
      sourceText={leftText}
      resultText={rightText}
      onSourceChange={setLeftText}
      onResultChange={setRightText}
      onCheck={() => checkSourceCode(leftText, appendLog)}
      onConvert={() => {
        const result = convertSourceCode(leftText, appendLog);
        if (result.ok) setRightText(result.output);
      }}
      onCopy={() => void copyConvertedCode(rightText, appendLog)}
    />
  );
}
