export default function HelpPage() {
  return (
    <div className="content-section tw-max-w-3xl">
      <h1 className="tw-text-3xl tw-font-bold tw-text-gray-800 tw-mb-2">Annotator Guide</h1>
      <p className="tw-text-gray-500 tw-mb-8">
        This guide explains how to annotate machine translation output using the MQM error taxonomy.
      </p>

      {/* ── 1. Overview ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">1. What you are doing</h2>
        <p className="tw-mb-3">
          You are evaluating the quality of machine-translated text using the{" "}
          <strong>Multidimensional Quality Metrics (MQM)</strong> framework. For each segment you will:
        </p>
        <ol className="tw-list-decimal tw-list-inside tw-space-y-1 tw-text-gray-700">
          <li>Read the <strong>source</strong> sentence (top row).</li>
          <li>Read the <strong>MT output</strong> (bottom row) and compare it to the source.</li>
          <li>Select and right-click any incorrect span in the MT output to mark it as an error.</li>
          <li>Choose an error <strong>category</strong> and <strong>severity</strong>, then save.</li>
          <li>Click <strong>Finish</strong> when you have marked all errors in the segment.</li>
        </ol>
        <p className="tw-mt-3 tw-text-gray-600">
          Only the MT output row is interactive — the source row is read-only.
        </p>
      </section>

      {/* ── 2. Navigation ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">2. Navigating segments</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>Use the <strong>← Previous</strong> and <strong>Next →</strong> links at the top to move between segments.</li>
          <li>The <strong>Done / Total</strong> counter in the header shows your progress.</li>
          <li>Segments you have already finished are shown with a green <em>"Segment marked as done"</em> bar. You can still navigate to them and review your markings.</li>
          <li>To go back and edit a finished segment, click <strong>Unlock to continue annotation</strong>.</li>
        </ul>
      </section>

      {/* ── 3. Creating a marking ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">3. Marking an error</h2>
        <ol className="tw-list-decimal tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>
            <strong>Select the erroneous span</strong> in the MT output row by clicking and dragging
            over the word(s). You can select one word or several consecutive words.
          </li>
          <li>
            <strong>Right-click</strong> on the selected text to open the marking popup.{" "}
            <span className="tw-text-gray-500">(Mac trackpad: two-finger tap.)</span>
          </li>
          <li>Choose an <strong>error category</strong> from the dropdown.</li>
          <li>Choose a <strong>severity level</strong>.</li>
          <li>
            Click <strong>+</strong> to save the marking. The span will be highlighted in a colour
            corresponding to its severity.
          </li>
        </ol>
        <div className="alert alert-info tw-mt-4 tw-text-sm">
          If no errors are present, simply click <strong>Finish</strong> without making any markings.
          You can use the <em>No Error</em> category if you want to explicitly record a clean segment.
        </div>
      </section>

      {/* ── 4. Editing or deleting a marking ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">4. Editing or removing a marking</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>
            <strong>Right-click on a highlighted span</strong> to re-open its popup. You can change
            the category or severity and save, or click <strong>−</strong> to delete it.
          </li>
          <li>
            If the segment is already marked as done, click <strong>Unlock to continue annotation</strong>{" "}
            first.
          </li>
        </ul>
      </section>

      {/* ── 5. Severity levels ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">5. Severity levels</h2>
        <table className="table tw-text-sm">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Colour</th>
              <th>MQM weight</th>
              <th>When to use</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Minor</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-green-600 tw-align-middle tw-mr-1"></span> Green</td>
              <td>1</td>
              <td>Slightly awkward but meaning is preserved; would not confuse a reader.</td>
            </tr>
            <tr>
              <td><strong>Major</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-yellow-500 tw-align-middle tw-mr-1"></span> Yellow</td>
              <td>5</td>
              <td>Clearly wrong; a reader would notice and meaning is degraded.</td>
            </tr>
            <tr>
              <td><strong>Critical</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-red-500 tw-align-middle tw-mr-1"></span> Red</td>
              <td>25</td>
              <td>Dangerous, misleading, or completely wrong; output is unusable for this span.</td>
            </tr>
            <tr>
              <td><strong>Not judgeable</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-blue-600 tw-align-middle tw-mr-1"></span> Blue</td>
              <td>0</td>
              <td>Cannot evaluate this span (e.g. source is itself erroneous or ambiguous).</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── 6. Error categories ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">6. Error categories</h2>

        <div className="tw-grid tw-grid-cols-1 tw-gap-6 sm:tw-grid-cols-2">

          <div>
            <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-2">Accuracy</h3>
            <table className="table tw-text-sm">
              <tbody>
                <tr><td className="tw-text-gray-500">A01</td><td>Mistranslation — wrong meaning</td></tr>
                <tr><td className="tw-text-gray-500">A02</td><td>Positive/Negative reversed</td></tr>
                <tr><td className="tw-text-gray-500">A03</td><td>Numbers wrong</td></tr>
                <tr><td className="tw-text-gray-500">A04</td><td>Pronoun wrong</td></tr>
                <tr><td className="tw-text-gray-500">A05</td><td>Proper noun wrong</td></tr>
                <tr><td className="tw-text-gray-500">A06</td><td>Omission — content missing</td></tr>
                <tr><td className="tw-text-gray-500">A07</td><td>Addition — content added</td></tr>
                <tr><td className="tw-text-gray-500">A08</td><td>Untranslated</td></tr>
                <tr><td className="tw-text-gray-500">A09</td><td>Other accuracy error</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-2">Fluency</h3>
            <table className="table tw-text-sm">
              <tbody>
                <tr><td className="tw-text-gray-500">F01</td><td>Spelling / typography</td></tr>
                <tr><td className="tw-text-gray-500">F03</td><td>Grammar</td></tr>
                <tr><td className="tw-text-gray-500">F04</td><td>Misuse of word</td></tr>
                <tr><td className="tw-text-gray-500">F05</td><td>Collocation</td></tr>
                <tr><td className="tw-text-gray-500">F06</td><td>Register (formal/informal)</td></tr>
                <tr><td className="tw-text-gray-500">F07</td><td>Ambiguity</td></tr>
                <tr><td className="tw-text-gray-500">F08</td><td>Unintelligible</td></tr>
                <tr><td className="tw-text-gray-500">F09</td><td>Symbols</td></tr>
                <tr><td className="tw-text-gray-500">F10</td><td>Other fluency error</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-2">Terminology</h3>
            <table className="table tw-text-sm">
              <tbody>
                <tr><td className="tw-text-gray-500">T01</td><td>Inconsistent with termbase</td></tr>
                <tr><td className="tw-text-gray-500">T02</td><td>Inconsistent with domain</td></tr>
                <tr><td className="tw-text-gray-500">T03</td><td>Inconsistent use within text</td></tr>
                <tr><td className="tw-text-gray-500">T04</td><td>Other terminology error</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-2">Style &amp; Locale</h3>
            <table className="table tw-text-sm">
              <tbody>
                <tr><td className="tw-text-gray-500">S01</td><td>Inconsistent with style guide</td></tr>
                <tr><td className="tw-text-gray-500">S02</td><td>Register</td></tr>
                <tr><td className="tw-text-gray-500">S03</td><td>Inconsistent style</td></tr>
                <tr><td className="tw-text-gray-500">S04</td><td>Other style error</td></tr>
                <tr><td className="tw-text-gray-500">L01</td><td>Locale convention (dates, units…)</td></tr>
                <tr><td className="tw-text-gray-500">SE1</td><td>Source error (problem is in the source)</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* ── 7. Tips ── */}
      <section className="tw-mb-6">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">7. Tips</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li><strong>Mac trackpad:</strong> two-finger tap = right-click.</li>
          <li><strong>One error per span:</strong> if two errors overlap on the same words, mark the most important one.</li>
          <li><strong>Source errors:</strong> if the source sentence itself is wrong or ambiguous, use category SE1 on the affected MT span and mark it <em>Not judgeable</em>.</li>
          <li><strong>Reference translation</strong> is shown below the MT output for guidance — it is not the ground truth, just a human reference.</li>
          <li><strong>Document context</strong> (if shown) lets you see surrounding segments to help resolve ambiguities.</li>
          <li>You can change your password at any time via the <strong>Account</strong> link in the navigation bar.</li>
        </ul>
      </section>
    </div>
  );
}
