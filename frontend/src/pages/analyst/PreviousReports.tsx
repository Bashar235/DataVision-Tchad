import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Eye, Loader2, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminAudit, downloadReport } from "@/services/api";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const PreviousReports = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getAdminAudit();
      const reportLogs = data
        .filter((log: any) => log.action === "REPORT_GENERATION" || log.action === "GENERATE_REPORT") // Support both old and new
        .map((log: any) => {
          let details = {};
          try {
            details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          } catch (e) {
            console.error("Failed to parse log details", e);
          }
          return {
            id: log.id,
            title: (details as any).template || log.action,
            date: new Date(log.created_at || log.time).toLocaleString(),
            path: (details as any).path,
            filename: (details as any).filename,
            type: t('previous_reports_pdf_type'),
          };
        });
      setReports(reportLogs);
    } catch (error) {
      console.error("Failed to fetch report history", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report: any, preview: boolean = false) => {
    if (!report.path && !report.filename) return;
    setDownloadingId(report.id);
    try {
      const filename = report.filename || report.path.split(/[\/\\]/).pop(); // Handle both separators
      if (!filename) throw new Error("Filename not found");

      const blob = await downloadReport(filename);

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

      if (preview) {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => window.URL.revokeObjectURL(url), 200);

    } catch (error) {
      console.error("Download failed", error);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('previous_reports_download_error'),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredReports = reports.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.date.includes(searchQuery)
  );

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
            <div className="text-start">
              <h1 className="text-3xl font-bold text-foreground">{t('side_nav_previous_reports')}</h1>
              <p className="text-muted-foreground">{t('reports_history')}</p>
            </div>

            <div className="relative w-full md:w-64">
              <Search className={`absolute ${isRtl ? 'right-2' : 'left-2'} top-2.5 h-4 w-4 text-muted-foreground`} />
              <Input
                placeholder={t('previous_reports_search_placeholder')}
                className={isRtl ? 'pr-8' : 'pl-8'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader className={`flex flex-row items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CardTitle className="text-start">{t('reports_history')}</CardTitle>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredReports.length > 0 ? filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className={`flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <FileText className="w-5 h-5 text-primary" />
                      <div className="text-start">
                        <p className="font-medium text-foreground">{report.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.date} • {report.type}
                        </p>
                      </div>
                    </div>
                    <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(report, true)} disabled={downloadingId === report.id}>
                        {downloadingId === report.id ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Eye className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                        {t('reports_preview_action')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(report, false)} disabled={downloadingId === report.id}>
                        <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                        {t('reports_download_report')}
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {loading ? t('updating_analytics') : t('previous_reports_no_reports')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PreviousReports;
