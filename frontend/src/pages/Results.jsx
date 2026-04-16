/*
 * Copyright (C) 2023 Yaraku, Inc.
 *
 * This file is part of Human Evaluation Tool.
 *
 * Human Evaluation Tool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Human Evaluation Tool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.
 *
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, September 2023
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Spinner from "../components/Spinner";
import { useEvaluations } from "../features/evaluations/useEvaluations";
import { getEvaluationResults } from "../services/apiEvaluations";

import "../assets/viewer.css";

function downloadTsv(rows, filename) {
  const blob = new Blob([rows.join("")], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsPage() {
  const [evaluationIndex, setEvaluationIndex] = useState(0);

  const { evaluations, isLoading: areEvaluationsLoading } = useEvaluations();
  const evaluationId = evaluations?.[evaluationIndex]?.["id"];
  const evaluationName = evaluations?.[evaluationIndex]?.["name"] ?? "results";

  const { data: evaluationResults, isLoading: areResultsLoading } = useQuery({
    queryKey: ["evaluationResults", evaluationId],
    queryFn: () => getEvaluationResults({ id: evaluationId }),
    enabled: !!evaluationId,
  });

  useEffect(() => {
    if (!areEvaluationsLoading && !areResultsLoading) {
      mqmCreateViewer(document.getElementById("mqm"));
    }
  }, [areEvaluationsLoading, areResultsLoading]);

  useEffect(() => {
    if (!areEvaluationsLoading && !areResultsLoading) {
      mqmSetData(evaluationResults);
    }
  }, [evaluationResults]);

  if (areEvaluationsLoading || areResultsLoading) {
    return <Spinner />;
  }

  return (
    <div className="tw-m-4">
      <div className="tw-flex tw-flex-row tw-items-center tw-gap-4 tw-flex-wrap">
        <h1 className="tw-text-lg tw-font-bold">Evaluation:</h1>
        <select
          value={evaluationIndex}
          onChange={(e) => setEvaluationIndex(Number(e.target.value))}
          className="form-control tw-w-auto"
        >
          {evaluations.map((evaluation, index) => (
            <option key={evaluation["id"]} value={index}>{evaluation["name"]}</option>
          ))}
        </select>
        {evaluationResults && evaluationResults.length > 0 && (
          <button
            className="btn btn-secondary tw-ml-auto"
            onClick={() =>
              downloadTsv(
                evaluationResults,
                `${evaluationName.replace(/\s+/g, "_")}_results.tsv`
              )
            }
          >
            Download TSV
          </button>
        )}
      </div>
      <hr />
      <div id="mqm"></div>
    </div>
  );
}
