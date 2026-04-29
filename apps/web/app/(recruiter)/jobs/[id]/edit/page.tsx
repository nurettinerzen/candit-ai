import { JobEditorForm } from "../../../../../components/job-editor-form";

type EditJobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { id } = await params;
  return <JobEditorForm mode="edit" jobId={id} />;
}
