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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import Marking from "../../components/Marking";
import Spinner from "../../components/Spinner";
import SpinnerMini from "../../components/SpinnerMini";
import {
  deleteAnnotation as deleteAnnotationApi,
  updateAnnotation as updateAnnotationApi,
} from "../../services/apiAnnotations";
import { useAnnotationMarkings } from "./useAnnotationMarkings";
import { useAnnotationSystems } from "./useAnnotationSystems";
import { useDocumentBitexts } from "./useDocumentBitexts";

export default function AnnotateInstance({
  containerRef,
  annotation,
  currentIndex,
  done,
  total,
  sideBySide,
}) {
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const isAnnotated = annotation["isAnnotated"];
  const isLastTask = !isAnnotated && done === total - 1;

  useEffect(() => {
    setConfirmingFinish(false);
  }, [annotation["id"]]);
  const { annotationMarkings, isLoading: areMarkingsLoading } =
    useAnnotationMarkings({
      id: annotation["id"],
    });
  const { annotationSystems, isLoading: areSystemsLoading } =
    useAnnotationSystems({
      id: annotation["id"],
    });
  const { documentBitexts, isLoading: areBitextsLoading } = useDocumentBitexts({
    id: annotation["bitext"]["documentId"],
  });
  const queryClient = useQueryClient();

  const annotationPayload = (isAnnotatedValue) => ({
    id: annotation["id"],
    userId: annotation["userId"],
    evaluationId: annotation["evaluation"]["id"],
    bitextId: annotation["bitext"]["id"],
    isAnnotated: isAnnotatedValue,
    comment: annotation["comment"] || "",
  });

  const { mutate: updateAnnotation, isLoading: isAnnotationUpdating } =
    useMutation({
      mutationFn: (data) => updateAnnotationApi(data),
      onSuccess: () => {},
      onError: (error) => {
        toast.error(
          `Failed to update annotation: ${error}. Please check your connection and try again.`,
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["annotations"] });
      },
    });

  const { mutate: deleteAnnotation, isLoading: isAnnotationDeleting } =
    useMutation({
      mutationFn: () => deleteAnnotationApi({ id: annotation["id"] }),
      onError: (error) => {
        toast.error(`Failed to delete task: ${error}. Please check your connection and try again.`);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["annotations"] });
      },
    });

  function handleDelete() {
    if (!window.confirm("Delete this task and all its markings? This cannot be undone.")) return;
    deleteAnnotation();
  }

  function handleFinish() {
    setConfirmingFinish(false);
    updateAnnotation(annotationPayload(true));
  }

  function handleUnlock() {
    updateAnnotation(annotationPayload(false));
  }

  if (areBitextsLoading || areMarkingsLoading || areSystemsLoading) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="tw-mb-6 tw-flex tw-justify-between">
        <div>
          <b>Evaluation:</b>&nbsp;
          {annotation["evaluation"]["name"]}
        </div>
        <div className="tw-space-x-6">
          <b>Task:</b>&nbsp;{currentIndex + 1}&nbsp;/&nbsp;{total}
          <b>Done:</b>&nbsp;{done}
        </div>
      </div>
      <div className="row">
        <div className="col alert alert-warning text-center">
          <h5>
            Please select and right-click to highlight incorrect spans in the
            translated sentences below.
          </h5>
        </div>
      </div>
      <div className="row">
        <div className="col align-middle">
          <div className="row text-left content-row d-flex justify-content-center">
            {annotationSystems.map((system, systemIndex) => {
              return (
                <div className="tw-select-none">
                  <Marking
                    containerRef={containerRef}
                    annotationId={annotation["id"]}
                    systemId={system["systemId"]}
                    systemName={system["systemName"]}
                    systemIndex={systemIndex}
                    annotationMarkings={annotationMarkings.filter(
                      (m) => m["systemId"] === system["systemId"],
                    )}
                    readOnly={isAnnotated}
                    sideBySide={sideBySide}
                    source={annotation["bitext"]["source"]}
                    target={system["translation"]}
                  />
                  <div className="border-top pt-3" />
                </div>
              );
            })}
            {documentBitexts.length > 1 ? (
              <div className="card">
                <div className="card-header">Document Context</div>
                <div className="card-body">
                  <table className="table">
                    <tr>
                      <th>Source</th>
                      <th>Target</th>
                    </tr>
                    {documentBitexts.map((bitext) => {
                      if (bitext["id"] === annotation["bitext"]["id"]) {
                        return (
                          <tr className="tw-border-b tw-border-t tw-border-solid tw-bg-green-100">
                            <td className="tw-whitespace-pre-wrap tw-py-4">
                              {bitext["source"]}
                            </td>
                            <td className="tw-whitespace-pre-wrap tw-py-4">
                              {bitext["target"]}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr className="tw-border-b tw-border-t tw-border-solid">
                          <td className="tw-whitespace-pre-wrap tw-py-4">
                            {bitext["source"]}
                          </td>
                          <td className="tw-whitespace-pre-wrap tw-py-4">
                            {bitext["target"]}
                          </td>
                        </tr>
                      );
                    })}
                  </table>
                </div>
              </div>
            ) : null}

            {/* ── Delete task ── */}
            <div className="tw-mt-4 tw-mb-2 tw-w-full tw-text-right">
              <button
                className="btn btn-sm btn-outline-danger"
                disabled={isAnnotationDeleting || isAnnotationUpdating}
                onClick={handleDelete}
              >
                {isAnnotationDeleting ? "Deleting…" : "Delete this task"}
              </button>
            </div>

            {/* ── Finish / Unlock button ── */}
            <div className="tw-mt-6 tw-mb-4 tw-w-full">
              {isAnnotated ? (
                <div className="alert alert-success tw-flex tw-items-center tw-justify-between tw-mb-0">
                  <span className="tw-font-semibold">&#10003; Task marked as done</span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={isAnnotationUpdating}
                    onClick={handleUnlock}
                  >
                    {isAnnotationUpdating ? <SpinnerMini /> : "Unlock to continue annotation"}
                  </button>
                </div>
              ) : (
                <>
                  {isLastTask && !confirmingFinish && (
                    <div className="alert alert-info tw-mb-3 tw-text-sm">
                      This is your last unannotated task.
                    </div>
                  )}
                  {!confirmingFinish ? (
                    <button
                      className="btn btn-primary tw-w-full"
                      disabled={isAnnotationUpdating}
                      onClick={() => setConfirmingFinish(true)}
                    >
                      {isAnnotationUpdating ? (
                        <div className="tw-flex tw-justify-center"><SpinnerMini /></div>
                      ) : (
                        "Mark task as done"
                      )}
                    </button>
                  ) : (
                    <div className="alert alert-warning tw-flex tw-flex-col tw-gap-3">
                      <p className="tw-mb-0 tw-font-semibold">
                        Have you annotated all errors in this task?
                      </p>
                      <div className="tw-flex tw-gap-3">
                        <button
                          className="btn btn-primary"
                          disabled={isAnnotationUpdating}
                          onClick={handleFinish}
                        >
                          {isAnnotationUpdating ? <SpinnerMini /> : "Yes, mark as done"}
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={isAnnotationUpdating}
                          onClick={() => setConfirmingFinish(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
