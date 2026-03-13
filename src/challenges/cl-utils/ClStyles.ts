/**
 * Challenge overlay CSS styles — injected once into the document head.
 */

let stylesInjected = false

export function injectClStyles(): void {
  if (stylesInjected) return
  stylesInjected = true

  const style = document.createElement('style')
  style.textContent = `
    .cl-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
    }

    .cl-panel {
      background: #fff8e7;
      border: 3px solid #ccaa66;
      border-radius: 6px;
      width: calc(100% - 40px);
      height: calc(100% - 40px);
      max-width: 100%;
      max-height: 100%;
      overflow-y: auto;
      padding: 24px 28px;
      font-family: 'Courier New', monospace;
      color: #333;
      box-sizing: border-box;
    }

    .cl-panel::-webkit-scrollbar {
      width: 8px;
    }
    .cl-panel::-webkit-scrollbar-track {
      background: #f0e8d0;
    }
    .cl-panel::-webkit-scrollbar-thumb {
      background: #ccaa66;
      border-radius: 4px;
    }

    .cl-title {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 18px;
    }

    .cl-text-block {
      font-size: 14px;
      color: #444;
      line-height: 1.6;
      margin-bottom: 12px;
      white-space: pre-wrap;
    }

    .cl-text-block strong {
      color: #222;
    }

    .cl-text-block code {
      background: #282c34;
      color: #e06c75;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #3e4451;
      font-size: 13px;
      font-family: 'Courier New', monospace;
    }

    .cl-code-block {
      margin-bottom: 14px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid #555;
    }

    .cl-code-block .cm-editor {
      font-size: 14px;
    }

    .cl-code-block .cm-editor .cm-scroller {
      padding: 8px 0;
    }

    /* ── IDE Editor Widget ── */
    .cl-editor-widget {
      margin-bottom: 14px;
      border-radius: 6px;
      border: 1px solid #3a3a5c;
      overflow: hidden;
      background: #1a1a2e;
    }

    .cl-editor-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1a1a2e;
      padding: 6px 12px;
      border-bottom: 1px solid #2a2a44;
    }

    .cl-editor-toolbar .cl-run-btn {
      background: #2a4a2a;
      color: #66ee66;
      border: 1px solid #3a6a3a;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      padding: 4px 14px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: background 0.15s;
    }
    .cl-editor-toolbar .cl-run-btn:hover {
      background: #3a6a3a;
    }
    .cl-editor-toolbar .cl-run-btn:disabled {
      opacity: 0.5;
      cursor: wait;
    }
    .cl-editor-toolbar .cl-run-btn .play-icon {
      font-size: 10px;
    }

    .cl-editor-toolbar .cl-run-status {
      font-size: 11px;
      color: #888;
      font-family: monospace;
    }
    .cl-editor-toolbar .cl-run-status.success {
      color: #66ee66;
    }
    .cl-editor-toolbar .cl-run-status.error {
      color: #ff6666;
    }

    .cl-editor-toolbar .cl-lang-label {
      margin-left: auto;
      font-size: 11px;
      color: #667;
      font-family: monospace;
      text-transform: lowercase;
    }

    .cl-editor-widget .cm-editor {
      font-size: 14px;
      border-radius: 0;
      border: none;
    }

    .cl-editor-widget .cm-editor .cm-scroller {
      padding: 8px 0;
    }

    .cl-console-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      border-top: 1px solid #2a2a44;
      background: #1a1a2e;
    }

    .cl-console-header .cl-console-label {
      font-size: 11px;
      color: #667;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .cl-console-header .cl-clear-btn {
      background: none;
      border: 1px solid #3a3a5c;
      color: #667;
      font-family: monospace;
      font-size: 10px;
      padding: 2px 8px;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.15s;
    }
    .cl-console-header .cl-clear-btn:hover {
      color: #aab;
      border-color: #556;
    }

    .cl-console-output {
      background: #12121f;
      color: #ccddff;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 8px 12px;
      white-space: pre-wrap;
      min-height: 32px;
      max-height: 150px;
      overflow-y: auto;
    }

    .cl-console-output .cl-prompt {
      color: #66ee66;
    }

    .cl-console-output .cl-error {
      color: #ff6666;
    }

    .cl-console-output .cl-placeholder {
      color: #556;
    }

    .cl-info-card {
      background: #fff0d0;
      border: 1px solid #ddaa44;
      border-radius: 4px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }

    .cl-info-card-title {
      font-size: 14px;
      font-weight: bold;
      color: #cc8800;
      margin-bottom: 6px;
    }

    .cl-info-card-content {
      font-size: 13px;
      color: #555;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .cl-info-card-content code {
      background: #282c34;
      color: #e06c75;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #3e4451;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    }

    .cl-info-card-content strong {
      color: #333;
    }

    details.cl-info-card summary::-webkit-details-marker {
      display: none;
    }

    details.cl-info-card summary {
      user-select: none;
    }

    .cl-image-placeholder {
      font-size: 12px;
      color: #888;
      font-style: italic;
      margin-bottom: 12px;
    }

    .cl-hint-bar {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #e0d8c0;
    }

    .cl-btn {
      background: #333344;
      color: #ccc;
      border: 1px solid #555;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 6px 18px;
      cursor: pointer;
      border-radius: 3px;
      margin: 4px;
    }
    .cl-btn:hover {
      background: #444466;
      color: #fff;
      border-color: #ffdd44;
    }
    .cl-btn.selected {
      background: #444466;
      border-color: #ffdd44;
      color: #ffdd44;
    }
    .cl-btn.correct {
      background: #224422;
      border-color: #22aa22;
      color: #22dd22;
    }
    .cl-btn.incorrect {
      background: #442222;
      border-color: #cc3333;
      color: #ff4444;
    }
    .cl-btn.dimmed {
      opacity: 0.4;
    }

    .cl-btn-primary {
      background: #335533;
      color: #88ff88;
      border: 1px solid #557755;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 6px 18px;
      cursor: pointer;
      border-radius: 3px;
    }
    .cl-btn-primary:hover {
      background: #447744;
    }

    .cl-attempt-counter {
      display: block;
      text-align: right;
      font-size: 11px;
      color: #888;
      margin-bottom: 4px;
    }

    .cl-success {
      color: #22aa22;
      font-weight: bold;
      text-align: center;
      font-size: 15px;
      margin: 10px 0;
    }

    .cl-failure {
      color: #cc3333;
      font-weight: bold;
      text-align: center;
      font-size: 15px;
      margin: 10px 0;
    }

    /* ── Fill-in-text ── */
    .cl-fill-template {
      background: #2d2d2d;
      padding: 12px 16px;
      border-radius: 4px;
      border: 1px solid #555;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #aaa;
      line-height: 1.8;
      margin-bottom: 14px;
      white-space: pre-wrap;
    }

    .cl-fill-slot {
      display: inline-block;
      min-width: 60px;
      padding: 2px 8px;
      background: #444455;
      color: #ffdd44;
      border-radius: 3px;
      border: 1px solid #666;
      cursor: pointer;
      text-align: center;
      font-size: 13px;
    }
    .cl-fill-slot.active {
      background: #555577;
      border-color: #ffdd44;
      box-shadow: 0 0 4px rgba(255, 221, 68, 0.3);
    }
    .cl-fill-slot.correct {
      background: #224422;
      border-color: #22aa22;
      color: #22dd22;
    }
    .cl-fill-slot.incorrect {
      background: #442222;
      border-color: #cc3333;
      color: #ff4444;
    }

    .cl-fill-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .cl-fill-chip {
      background: #333344;
      color: #ccc;
      border: 1px solid #555;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 4px 12px;
      cursor: pointer;
      border-radius: 3px;
    }
    .cl-fill-chip:hover {
      background: #444466;
      color: #fff;
      border-color: #888;
    }
    .cl-fill-chip.selected {
      border-color: #ffdd44;
      color: #ffdd44;
    }
    .cl-fill-chip.used {
      opacity: 0.3;
      cursor: default;
    }

    /* ── Matching pairs ── */
    .cl-match-container {
      display: flex;
      gap: 40px;
      margin-bottom: 14px;
    }

    .cl-match-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cl-match-item {
      background: #333344;
      color: #ccc;
      border: 1px solid #555;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 3px;
      text-align: center;
    }
    .cl-match-item:hover {
      background: #444466;
    }
    .cl-match-item.selected {
      border-color: #ffdd44;
      color: #ffdd44;
    }
    .cl-match-item.connected {
      border-color: #4488cc;
      color: #88bbff;
    }
    .cl-match-item.correct {
      background: #1a331a;
      border-color: #22aa22;
      color: #22dd22;
      cursor: default;
      pointer-events: none;
    }
    .cl-match-item.incorrect {
      border-color: #cc3333;
      color: #ff4444;
    }

    .cl-match-lines {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    /* ── Solution overlay ── */
    .cl-solution-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cl-solution-panel {
      background: #1e1e2e;
      border: 2px solid #ccaa66;
      border-radius: 6px;
      width: calc(100% - 50px);
      max-height: calc(100% - 50px);
      overflow-y: auto;
      padding: 20px 24px;
      font-family: 'Courier New', monospace;
    }

    .cl-solution-title {
      font-size: 18px;
      font-weight: bold;
      color: #ffdd44;
      text-align: center;
      margin-bottom: 16px;
    }

    .cl-solution-text {
      font-size: 13px;
      color: #ccc;
      line-height: 1.6;
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
  `
  document.head.appendChild(style)
}
