"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useUiText } from "./site-language-provider";
import type {
  InterviewQuestionDraftItem,
  InterviewQuestionnairePreview,
  InterviewTemplate,
  QuickActionType,
  QuickActionResult
} from "../lib/types";
import { MatchIndicator } from "./match-indicator";

type InterviewInviteModalProps = {
  open: boolean;
  applicationId: string | null;
  action: Extract<QuickActionType, "invite_interview" | "reinvite_interview">;
  candidateName: string;
  jobTitle: string;
  roleFamily?: string | null;
  onClose: () => void;
  onSubmitted: (result: QuickActionResult) => void;
};

function estimateDurationFromQuestions(count: number) {
  const min = Math.max(10, count * 2);
  const max = Math.max(min + 4, count * 3);
  return `${min}-${max} dk`;
}

export function InterviewInviteModal({
  open,
  applicationId,
  action,
  candidateName,
  jobTitle,
  roleFamily,
  onClose,
  onSubmitted
}: InterviewInviteModalProps) {
  const { t } = useUiText();
  const isReinvite = action === "reinvite_interview";
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<InterviewQuestionnairePreview | null>(null);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestionDraftItem[]>([]);
  const [suggestions, setSuggestions] = useState<InterviewQuestionDraftItem[]>([]);

  useEffect(() => {
    if (!open || !applicationId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [templateRows, questionnaire] = await Promise.all([
          apiClient.listInterviewTemplates(roleFamily ?? undefined).catch(() => []),
          apiClient.previewInterviewQuestionnaire(applicationId)
        ]);

        if (cancelled) {
          return;
        }

        setTemplates(templateRows);
        setPreview(questionnaire);
        setSelectedTemplateId(questionnaire.template.id);
        setQuestions(questionnaire.questions);
        setSuggestions(questionnaire.suggestions);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : t("Soru listesi yüklenemedi."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [applicationId, open, roleFamily]);

  const reloadForTemplate = async (templateId: string) => {
    if (!applicationId) {
      return;
    }

    setSelectedTemplateId(templateId);
    setLoading(true);
    setError("");

    try {
      const questionnaire = await apiClient.previewInterviewQuestionnaire(applicationId, templateId);
      setPreview(questionnaire);
      setQuestions(questionnaire.questions);
      setSuggestions(questionnaire.suggestions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Template yüklenemedi."));
    } finally {
      setLoading(false);
    }
  };

  const addManualQuestion = () => {
    setQuestions((current) => [
      ...current,
      {
        id: `custom_${Date.now()}`,
        key: `custom_${current.length + 1}`,
        questionKey: `custom_question_${current.length + 1}`,
        category: "özel_soru",
        prompt: "",
        followUps: [],
        source: "custom"
      }
    ]);
  };

  const addSuggestion = (suggestion: InterviewQuestionDraftItem) => {
    setQuestions((current) => {
      const exists = current.some(
        (item) => item.prompt.trim().toLocaleLowerCase("tr-TR") === suggestion.prompt.trim().toLocaleLowerCase("tr-TR")
      );

      if (exists) {
        return current;
      }

      return [
        ...current,
        {
          ...suggestion,
          id: `custom_${suggestion.key}_${Date.now()}`,
          source: "custom"
        }
      ];
    });
  };

  const addAllSuggestions = () => {
    suggestions.forEach((suggestion) => addSuggestion(suggestion));
  };

  const updateQuestion = (id: string, prompt: string) => {
    setQuestions((current) =>
      current.map((item) => (item.id === id ? { ...item, prompt } : item))
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((current) => (current.length <= 1 ? current : current.filter((item) => item.id !== id)));
  };

  const sanitizedQuestionnaire = useMemo(
    () =>
      questions
        .map((question, index) => ({
          key: question.key || `custom_${index + 1}`,
          questionKey: question.questionKey || `question_${index + 1}`,
          category: question.category || "özel_soru",
          prompt: question.prompt.trim(),
          followUps: question.followUps
        }))
        .filter((question) => question.prompt.length >= 3),
    [questions]
  );
  const availableTemplates = useMemo(() => {
    if (!preview) {
      return templates;
    }

    return templates.some((template) => template.id === preview.template.id)
      ? templates
      : [
          ...templates,
          {
            id: preview.template.id,
            name: preview.template.name,
            version: preview.template.version,
            roleFamily: preview.template.roleFamily,
            isActive: true
          }
        ];
  }, [preview, templates]);

  const durationLabel = estimateDurationFromQuestions(Math.max(sanitizedQuestionnaire.length, 1));

  const handleSubmit = async () => {
    if (!applicationId) {
      return;
    }

    if (sanitizedQuestionnaire.length === 0) {
      setError(t("En az bir soru bırakmalısınız."));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await apiClient.quickAction(applicationId, {
        action,
        templateId: selectedTemplateId || preview?.template.id,
        questionnaire: sanitizedQuestionnaire
      });
      onSubmitted(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Davet gönderilemedi."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !applicationId) {
    return null;
  }

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(event) => event.stopPropagation()}>
        <div className="invite-modal-head">
          <div>
            <p className="invite-modal-kicker">{t(isReinvite ? "AI mülakatını yeniden başlat" : "AI mülakat ayarları")}</p>
            <h3>{candidateName}</h3>
            <p className="invite-modal-subtitle">
              {t(
                isReinvite
                  ? `${jobTitle} için yeni AI mülakat linki hazırlanıyor.`
                  : `${jobTitle} için davet gönderiliyor.`
              )}
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading && <p className="text-sm text-muted">{t("Soru listesi hazırlanıyor...")}</p>}
        {error && !loading && <div className="invite-modal-error">{error}</div>}

        {!loading && preview && (
          <>
            <div className="invite-modal-summary-grid">
              <section className="invite-summary-card">
                <span className="invite-summary-label">{t("Eşleşme")}</span>
                <MatchIndicator score={preview.match.score} />
                {preview.match.reasons.length > 0 && (
                  <ul className="invite-summary-reasons">
                    {preview.match.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="invite-summary-card">
                <span className="invite-summary-label">Template</span>
                <select
                  className="select"
                  value={selectedTemplateId}
                  onChange={(event) => void reloadForTemplate(event.target.value)}
                >
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <p className="invite-summary-caption">
                  Tahmini görüşme süresi: <strong>{durationLabel}</strong>
                </p>
              </section>
            </div>

            <section className="invite-question-panel">
              <div className="invite-question-panel-head">
                <div>
                  <h4>Gözden geçirilecek soru listesi</h4>
                  <p>
                    AI bu ana soruları temel alacak. İstersen soruları düzenleyebilir, silebilir ya da yeni soru ekleyebilirsin.
                  </p>
                </div>
                <div className="invite-question-actions">
                  <button type="button" className="ghost-button" onClick={addManualQuestion}>
                    Soru Ekle
                  </button>
                  {suggestions.length > 0 && (
                    <button type="button" className="ghost-button" onClick={addAllSuggestions}>
                      Önerilenleri Ekle
                    </button>
                  )}
                </div>
              </div>

              <div className="invite-question-list">
                {questions.map((question, index) => (
                  <div key={question.id} className="invite-question-item">
                    <div className="invite-question-index">{index + 1}</div>
                    <div className="invite-question-body">
                      <textarea
                        className="textarea invite-question-textarea"
                        value={question.prompt}
                        onChange={(event) => updateQuestion(question.id, event.target.value)}
                        rows={2}
                      />
                      {question.reason && (
                        <span className="invite-question-reason">{question.reason}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ghost-button invite-question-remove"
                      onClick={() => removeQuestion(question.id)}
                      disabled={questions.length <= 1}
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {suggestions.length > 0 && (
              <section className="invite-suggestions-panel">
                <div className="invite-question-panel-head">
                  <div>
                    <h4>Önerilen ek sorular</h4>
                    <p>Eksik bilgi ve risk sinyallerinden üretildi.</p>
                  </div>
                </div>
                <div className="invite-suggestions-list">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="invite-suggestion-chip"
                      onClick={() => addSuggestion(suggestion)}
                    >
                      <strong>{suggestion.prompt}</strong>
                      {suggestion.reason ? <span>{suggestion.reason}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="invite-modal-footer">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={onClose}>
                Vazgeç
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-primary"
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? "Gönderiliyor..." : isReinvite ? "Yeni Link Gönder" : "Daveti Gönder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
