export default function HelpPage() {
  return (
    <div className="content-section tw-max-w-3xl">
      <h1 className="tw-text-3xl tw-font-bold tw-text-gray-800 tw-mb-2">Guide de l'annotateur</h1>
      <p className="tw-text-gray-500 tw-mb-8">
        Ce guide explique comment annoter la sortie de traduction automatique à l'aide de la taxonomie d'erreurs MQM.
      </p>

      {/* ── 1. Overview ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">1. Votre tâche</h2>
        <p className="tw-mb-3">
          Vous évaluez la qualité de textes traduits automatiquement à l'aide du cadre{" "}
          <strong>Multidimensional Quality Metrics (MQM)</strong>. Pour chaque segment, vous devez :
        </p>
        <ol className="tw-list-decimal tw-list-inside tw-space-y-1 tw-text-gray-700">
          <li>Lire la phrase <strong>source</strong> (rangée du haut).</li>
          <li>Lire la <strong>sortie TA</strong> (rangée du bas) et la comparer à la source.</li>
          <li>Sélectionner et faire un clic droit sur tout segment incorrect dans la sortie TA pour le marquer comme erreur.</li>
          <li>Choisir une <strong>catégorie</strong> d'erreur et un niveau de <strong>gravité</strong>, puis enregistrer.</li>
          <li>Cliquer sur <strong>Terminé</strong> quand vous avez marqué toutes les erreurs du segment.</li>
        </ol>
        <p className="tw-mt-3 tw-text-gray-600">
          Seule la rangée de sortie TA est interactive — la rangée source est en lecture seule.
        </p>
      </section>

      {/* ── 2. Navigation ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">2. Navigation entre les segments</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>Utilisez les boutons <strong>← Précédent</strong> et <strong>Suivant →</strong> en haut pour passer d'un segment à l'autre.</li>
          <li>Le compteur <strong>Terminé / Total</strong> dans l'en-tête indique votre progression.</li>
          <li>Les segments déjà terminés affichent un indicateur ✓ <em>Terminé</em> dans l'en-tête. Vous pouvez toujours y accéder et réviser vos annotations.</li>
          <li>Pour revenir modifier un segment terminé, cliquez sur <strong>Déverrouiller</strong>.</li>
        </ul>
      </section>

      {/* ── 3. Creating a marking ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">3. Annoter une erreur</h2>
        <ol className="tw-list-decimal tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>
            <strong>Sélectionnez le segment erroné</strong> dans la rangée de sortie TA en cliquant et faisant glisser sur le ou les mots. Vous pouvez sélectionner un seul mot ou plusieurs mots consécutifs.
          </li>
          <li>
            <strong>Faites un clic droit</strong> sur le texte sélectionné pour ouvrir la fenêtre d'annotation.{" "}
            <span className="tw-text-gray-500">(Pavé tactile Mac : tapotez avec deux doigts.)</span>
          </li>
          <li>Choisissez une <strong>catégorie d'erreur</strong> dans le menu déroulant.</li>
          <li>Choisissez un <strong>niveau de gravité</strong>.</li>
          <li>
            Cliquez sur <strong>OK</strong> pour enregistrer l'annotation. Le segment sera surligné dans la couleur correspondant à sa gravité.
          </li>
        </ol>
        <div className="alert alert-info tw-mt-4 tw-text-sm">
          S'il n'y a pas d'erreur, sélectionnez l'ensemble du segment, faites un clic droit et choisissez la catégorie <em>No Error</em>. Cliquez ensuite sur <strong>Terminé</strong>.
        </div>
      </section>

      {/* ── 4. Editing or deleting a marking ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">4. Modifier ou supprimer une annotation</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li>
            <strong>Faites un clic droit sur un segment surligné</strong> pour rouvrir sa fenêtre d'annotation. Vous pouvez modifier la catégorie ou la gravité, puis enregistrer, ou cliquer sur <strong>−</strong> pour supprimer.
          </li>
          <li>
            Si le segment est déjà marqué comme terminé, cliquez d'abord sur <strong>Déverrouiller</strong>.
          </li>
        </ul>
      </section>

      {/* ── 5. Severity levels ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">5. Niveaux de gravité</h2>
        <table className="table tw-text-sm">
          <thead>
            <tr>
              <th>Gravité</th>
              <th>Couleur</th>
              <th>Poids MQM</th>
              <th>Quand l'utiliser</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Mineure</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-green-600 tw-align-middle tw-mr-1"></span> Vert</td>
              <td>1</td>
              <td>Légèrement maladroit mais le sens est préservé ; ne confondrait pas un lecteur.</td>
            </tr>
            <tr>
              <td><strong>Majeure</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-yellow-500 tw-align-middle tw-mr-1"></span> Jaune</td>
              <td>5</td>
              <td>Clairement incorrecte ; un lecteur le remarquerait et le sens est dégradé.</td>
            </tr>
            <tr>
              <td><strong>Critique</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-red-500 tw-align-middle tw-mr-1"></span> Rouge</td>
              <td>25</td>
              <td>Dangereuse, trompeuse ou complètement fausse ; la sortie est inutilisable pour ce segment.</td>
            </tr>
            <tr>
              <td><strong>Non évaluable</strong></td>
              <td><span className="tw-inline-block tw-w-4 tw-h-4 tw-rounded tw-bg-blue-600 tw-align-middle tw-mr-1"></span> Bleu</td>
              <td>0</td>
              <td>Impossible d'évaluer ce segment (p. ex. la source elle-même est erronée ou ambiguë).</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── 6. Error categories ── */}
      <section className="tw-mb-10">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">6. Catégories d'erreurs</h2>

        {/* Accuracy */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Accuracy</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Erreur de traduction, de sens, informationnelles, de contenu, etc.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">A01</td>
                <td><strong>Mistranslation</strong><br /><span className="tw-text-gray-500">Le contenu cible ne représente pas fidèlement le contenu source. Comprend faux-sens, contresens et glissements.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A02</td>
                <td><strong>Overtranslation</strong><br /><span className="tw-text-gray-500">Un élément qui peut ou doit demeurer implicite a été explicité dans le segment prétraduit.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A03</td>
                <td><strong>Undertranslation</strong><br /><span className="tw-text-gray-500">Un élément qui doit être explicité ne l'est pas dans le segment prétraduit.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A04</td>
                <td><strong>Omission</strong><br /><span className="tw-text-gray-500">Error where content present in the source is missing in the target.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A05</td>
                <td><strong>Addition</strong><br /><span className="tw-text-gray-500">Error occurring in the target content that includes elements not present in the source.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A06</td>
                <td><strong>Transposition</strong><br /><span className="tw-text-gray-500">A text feature that should have been kept in the source language was translated (proper nouns, brand names, numbers, etc.).</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A07</td>
                <td><strong>Untranslated</strong><br /><span className="tw-text-gray-500">Error occurring when a text segment that was intended for translation is left untranslated in the target content.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A08</td>
                <td><strong>Gibberish</strong><br /><span className="tw-text-gray-500">Unintelligible, meaningless, or nonsensical translation.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">A09</td>
                <td><strong>Other</strong><br /><span className="tw-text-gray-500">Hallucinations, output in another language than the one intended, or other malfunction.</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Linguistic conventions */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Linguistic conventions</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Errors related to the linguistic well-formedness of the target text. Erreurs de langue.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">L01</td>
                <td><strong>Grammar and syntax</strong><br /><span className="tw-text-gray-500">Error that occurs when a text string violates the grammatical rules of the target language (agreement, verb tense, declension, etc.).</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">L02</td>
                <td><strong>Punctuation</strong><br /><span className="tw-text-gray-500">Punctuation incorrect according to target language conventions.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">L03</td>
                <td><strong>Spelling</strong><br /><span className="tw-text-gray-500">Error occurring when a word is misspelled. Comprend les barbarismes et anglicismes.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">L04</td>
                <td><strong>Character</strong><br /><span className="tw-text-gray-500">Text garbled or incomprehensible due to incorrect character encoding. À distinguer de Gibberish (A08), qui réfère au nonsens sémantique.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">L05</td>
                <td><strong>Other</strong><br /><span className="tw-text-gray-500">Par exemple : locutions et expressions figées déformées.</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terminology */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Terminology</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Errors arising when a term does not conform to normative subject-field or organizational terminology standards, or when a term in the target is not the correct equivalent of the source term.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">T01</td>
                <td><strong>Inconsistent with terminology resources</strong><br /><span className="tw-text-gray-500">Use of a term that differs from term usage required by a specified termbase or other resource.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">T02</td>
                <td><strong>Wrong term</strong><br /><span className="tw-text-gray-500">Use of a term that is not what a domain expert would use, or that gives rise to a conceptual mismatch.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">T03</td>
                <td><strong>Inconsistent use of terminology</strong><br /><span className="tw-text-gray-500">Use of multiple terms for the same concept in cases where consistency is required.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">T04</td>
                <td><strong>Other</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Style */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Style</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Errors occurring in text that is grammatically acceptable but inappropriate because it deviates from style standards for the domain or text type.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">S01</td>
                <td><strong>Textual conventions</strong><br /><span className="tw-text-gray-500">Conventions relatives à l'écriture scientifique, au type de texte et au domaine (autres que registre et conciseness). Ex. : introduction d'un agent dans une phrase volontairement passive, lexique émotif ou connoté.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S02</td>
                <td><strong>Register</strong><br /><span className="tw-text-gray-500">Text uses a level of formality higher or lower than required by conventions (e.g., colloquialisms in a formal document).</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S03</td>
                <td><strong>Lack of clarity</strong><br /><span className="tw-text-gray-500">The intended meaning can be understood and the text is grammatically correct, but the text is very awkward and difficult to follow.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S04</td>
                <td><strong>Conciseness</strong><br /><span className="tw-text-gray-500">Excessive wordiness and lexical repetitions.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S05</td>
                <td><strong>Unidiomatic</strong><br /><span className="tw-text-gray-500">Style that is grammatical but unnatural. Co-occurrence and collocation problems, often from inappropriate retention of source-language style.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S06</td>
                <td><strong>Coherence and cohesion</strong><br /><span className="tw-text-gray-500">Violation of text-building (discourse) norms: poor local cohesion (connecting to previous text) or global coherence (overall message and information flow).</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S07</td>
                <td><strong>Inconsistent with external reference</strong><br /><span className="tw-text-gray-500">Text fails to conform with a declared external style reference (e.g., an existing official translation of a quotation was not reused).</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">S08</td>
                <td><strong>Other</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Locale */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Locale</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Errors occurring when the translation violates locale-specific content or formatting requirements.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">LC1</td>
                <td><strong>Locale conventions</strong><br /><span className="tw-text-gray-500">Inappropriate number, measurement, time, or date format for the target locale (e.g., decimal separators, date ordering).</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Audience appropriateness */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Audience appropriateness</h3>
          <p className="tw-text-gray-500 tw-text-sm tw-mb-2">Errors arising from target content that is invalid or inappropriate for the target locale or audience.</p>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">P01</td>
                <td><strong>Culture-specific reference</strong><br /><span className="tw-text-gray-500">Content that uses a culture-specific reference that will not be understandable to the intended audience.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">P02</td>
                <td><strong>Offensive</strong><br /><span className="tw-text-gray-500">Content that breaches commonly accepted standards of proper speech and is likely to offend the intended audience.</span></td>
              </tr>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap">P03</td>
                <td><strong>Other</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Source Error */}
        <div className="tw-mb-6">
          <h3 className="tw-font-semibold tw-text-gray-700 tw-mb-1">Source Error</h3>
          <table className="table tw-text-sm">
            <tbody>
              <tr>
                <td className="tw-text-gray-400 tw-align-top tw-whitespace-nowrap tw-w-12">SE1</td>
                <td><strong>Source Error</strong><br /><span className="tw-text-gray-500">The problem is in the source text, not the translation. Use this together with the <em>Not judgeable</em> severity.</span></td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

      {/* ── 7. Tips ── */}
      <section className="tw-mb-6">
        <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">7. Conseils pratiques</h2>
        <ul className="tw-list-disc tw-list-inside tw-space-y-2 tw-text-gray-700">
          <li><strong>Pavé tactile Mac :</strong> tapotez avec deux doigts = clic droit.</li>
          <li><strong>Une erreur par segment :</strong> si deux erreurs se chevauchent sur les mêmes mots, annotez la plus importante.</li>
          <li><strong>Erreurs de source :</strong> si la phrase source elle-même est incorrecte ou ambiguë, utilisez la catégorie SE1 sur le segment TA affecté et marquez-le <em>Non évaluable</em>.</li>
          <li><strong>La traduction de référence</strong> est affichée sous la sortie TA à titre indicatif — ce n'est pas la vérité absolue, juste une référence humaine.</li>
          <li><strong>Le contexte du document</strong> (si affiché) vous permet de voir les segments environnants pour lever les ambiguïtés.</li>
          <li>Vous pouvez changer votre mot de passe à tout moment via le lien <strong>Mon compte</strong> dans la barre de navigation.</li>
        </ul>
      </section>
    </div>
  );
}
