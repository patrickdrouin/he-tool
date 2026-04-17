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
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Spinner from "../components/Spinner";
import AnnotateInstance from "../features/annotations/AnnotateInstance";
import { useAnnotations } from "../features/annotations/useAnnotations";
import { clamp } from "../services/utils";

export default function AnnotatePage() {
  const containerRef = useRef(null);
  const [currentAnnotation, setCurrentAnnotation] = useState(0);
  const [sideBySide, setSideBySide] = useState(false);
  const [searchParams] = useSearchParams();
  const evaluationId = searchParams.get("evaluation")
    ? parseInt(searchParams.get("evaluation"), 10)
    : undefined;
  const { status, annotations, isLoading } = useAnnotations({ evaluationId });

  const sortedAnnotations = [...(annotations ?? [])].sort((a, b) => a["id"] - b["id"]);
  const total = sortedAnnotations.length;
  const done = sortedAnnotations.filter((a) => a["isAnnotated"]).length;

  useEffect(() => {
    if (status === "success") {
      setCurrentAnnotation(clamp(currentAnnotation, 0, total - 1));
    }
  }, [status, annotations]);

  if (isLoading) {
    return <Spinner />;
  }

  if (total === 0) {
    return (
      <div className="container">
        <div className="tw-flex tw-flex-col tw-items-center tw-mt-12">
          <h1 className="tw-mb-4 tw-text-3xl tw-font-bold">No tasks assigned</h1>
          <p className="tw-text-lg">Ask your admin to assign an evaluation to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" ref={containerRef}>
      <div className="row">
        <div className="col-12">
          <div id="annotation" className="row">
            {/* ── Navigation bar ── */}
            <div className="tw-mb-3 tw-flex tw-justify-between tw-items-center">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={currentAnnotation === 0}
                onClick={() => setCurrentAnnotation(clamp(currentAnnotation - 1, 0, total - 1))}
              >
                &larr; Previous
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSideBySide((v) => !v)}
              >
                {sideBySide ? "Stacked view" : "Side-by-side view"}
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={currentAnnotation >= total - 1}
                onClick={() => setCurrentAnnotation(clamp(currentAnnotation + 1, 0, total - 1))}
              >
                Next &rarr;
              </button>
            </div>

            <AnnotateInstance
              containerRef={containerRef}
              annotation={sortedAnnotations[clamp(currentAnnotation, 0, total - 1)]}
              currentIndex={clamp(currentAnnotation, 0, total - 1)}
              done={done}
              total={total}
              sideBySide={sideBySide}
              onNavigateToBitext={(bitextId) => {
                const idx = sortedAnnotations.findIndex((a) => a["bitext"]["id"] === bitextId);
                if (idx !== -1) setCurrentAnnotation(idx);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
