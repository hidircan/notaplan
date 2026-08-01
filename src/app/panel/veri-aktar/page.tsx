import { PageHeader } from "@/components/ui";
import { CsvImportSection } from "@/components/csv-import-section";
import {
  actionPreviewBranchImport,
  actionCommitBranchImport,
  actionPreviewTeacherImport,
  actionCommitTeacherImport,
  actionPreviewRoomImport,
  actionCommitRoomImport,
  actionPreviewStudentImport,
  actionCommitStudentImport,
} from "@/lib/actions";
import { BRANCH_CSV_COLUMNS, BRANCH_CSV_SAMPLE } from "@/lib/import/branches";
import { TEACHER_CSV_COLUMNS, TEACHER_CSV_SAMPLE } from "@/lib/import/teachers";
import { ROOM_CSV_COLUMNS, ROOM_CSV_SAMPLE } from "@/lib/import/rooms";
import { STUDENT_CSV_COLUMNS, STUDENT_CSV_SAMPLE } from "@/lib/import/students";

export const dynamic = "force-dynamic";

export default function VeriAktarPage() {
  return (
    <div>
      <PageHeader
        title="Veri Aktarım Merkezi"
        description="Şube, öğretmen, oda ve öğrenci kayıtlarınızı CSV ile topluca aktarın. Önce önizleyin, hata yoksa aktarın. Güvenli sıra: şube → öğretmen → oda → öğrenci."
      />

      <div className="space-y-6">
        <CsvImportSection
          title="1. Şubeler"
          description="Yeni şubeleri toplu ekleyin. Aynı kısa ada sahip bir şube varsa güncellenir."
          columns={BRANCH_CSV_COLUMNS}
          sampleCsv={BRANCH_CSV_SAMPLE}
          sampleFileName="subeler_ornek.csv"
          successHref="/panel/subeler"
          successLinkLabel="Şubeleri görüntüle"
          onPreview={actionPreviewBranchImport}
          onCommit={actionCommitBranchImport}
        />

        <CsvImportSection
          title="2. Öğretmenler"
          description="Şube sütununda kısa ad veya tam ad kullanın. E-posta zorunludur — hem tekrar aktarımda hem öğrenci eşlemesinde kullanılır."
          columns={TEACHER_CSV_COLUMNS}
          sampleCsv={TEACHER_CSV_SAMPLE}
          sampleFileName="ogretmenler_ornek.csv"
          successHref="/panel/ogretmenler"
          successLinkLabel="Öğretmenleri görüntüle"
          onPreview={actionPreviewTeacherImport}
          onCommit={actionCommitTeacherImport}
        />

        <CsvImportSection
          title="3. Odalar"
          description="Birden fazla enstrüman için hücre içinde noktalı virgül kullanın (Örn. Piyano;Gitar)."
          columns={ROOM_CSV_COLUMNS}
          sampleCsv={ROOM_CSV_SAMPLE}
          sampleFileName="odalar_ornek.csv"
          successHref="/panel/odalar"
          successLinkLabel="Odaları görüntüle"
          onPreview={actionPreviewRoomImport}
          onCommit={actionCommitRoomImport}
        />

        <CsvImportSection
          title="4. Öğrenciler"
          description="Öğretmen sütununda öğretmenin e-postasını kullanın. E-posta alanı öğrenci için opsiyoneldir, telefon zorunludur."
          columns={STUDENT_CSV_COLUMNS}
          sampleCsv={STUDENT_CSV_SAMPLE}
          sampleFileName="ogrenciler_ornek.csv"
          successHref="/panel/ogrenciler"
          successLinkLabel="Öğrencileri görüntüle"
          onPreview={actionPreviewStudentImport}
          onCommit={actionCommitStudentImport}
        />
      </div>
    </div>
  );
}
