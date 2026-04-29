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
import { updateAnnotation as updateAnnotationApi } from "../../services/apiAnnotations";
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
  doneBitextIds = new Set(),
  onNavigateToBitext,
}) {
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const isAnnotated = annotation["isAnnotated"];

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
          `Échec de la mise à jour de l'annotation : ${error}. Veuillez vérifier votre connexion et réessayer.`,
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["annotations"] });
      },
    });

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
      <div className="tw-mb-6 tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
        <div>
          <b>Évaluation :</b>&nbsp;{annotation["evaluation"]["name"]}
        </div>
        <div className="tw-flex tw-items-center tw-gap-4">
          <span className="tw-space-x-4">
            <b>Tâche :</b>&nbsp;{currentIndex + 1}&nbsp;/&nbsp;{total}
            <b>Terminé :</b>&nbsp;{done}
          </span>
          {isAnnotated ? (
            <div className="tw-flex tw-items-center tw-gap-2">
              <span className="tw-text-green-700 tw-font-semibold tw-text-sm">&#10003; Terminé</span>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={isAnnotationUpdating}
                onClick={handleUnlock}
              >
                {isAnnotationUpdating ? <SpinnerMini /> : "Déverrouiller"}
              </button>
            </div>
          ) : !confirmingFinish ? (
            <button
              className="btn btn-sm btn-primary"
              disabled={isAnnotationUpdating}
              onClick={() => setConfirmingFinish(true)}
            >
              {isAnnotationUpdating ? <SpinnerMini /> : "Terminé"}
            </button>
          ) : (
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
              <span className="tw-font-semibold">Toutes les erreurs ont été annotées ?</span>
              <button
                className="btn btn-sm btn-primary"
                disabled={isAnnotationUpdating}
                onClick={handleFinish}
              >
                {isAnnotationUpdating ? <SpinnerMini /> : "Oui"}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                disabled={isAnnotationUpdating}
                onClick={() => setConfirmingFinish(false)}
              >
                Non
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="row">
        <div className="col alert alert-warning text-center">
          <h5>
            Sélectionnez et faites un clic droit pour surligner les segments incorrects dans les phrases traduites ci-dessous.
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
                <div className="card-header">Contexte du document</div>
                <div className="card-body">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Source</th>
                        <th>Traduction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentBitexts.map((bitext, rowIndex) => {
                        const isActive = bitext["id"] === annotation["bitext"]["id"];
                        const isDone = doneBitextIds.has(bitext["id"]);
                        return (
                          <tr
                            key={bitext["id"]}
                            className={[
                              "tw-cursor-pointer",
                              isDone ? "table-success" : isActive ? "table-active" : "",
                            ].join(" ")}
                            onClick={() => onNavigateToBitext && onNavigateToBitext(bitext["id"])}
                          >
                            <td className="tw-py-4 tw-pr-2 tw-text-gray-500 tw-text-sm tw-w-8">
                              {rowIndex + 1}
                            </td>
                            <td className="tw-whitespace-pre-wrap tw-py-4">
                              {bitext["source"]}
                            </td>
                            <td className="tw-whitespace-pre-wrap tw-py-4">
                              {bitext["target"]}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}
