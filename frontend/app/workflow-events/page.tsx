import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWorkflowEvents } from "@/lib/queries";

export const revalidate = 0; // Disable caching for this page

export default async function WorkflowEventsPage() {
  const events = await getWorkflowEvents();

  const tickets = events.filter((e) => e.event_type === "TICKET_CREATED").length;
  const notifications = events.filter((e) => e.event_type === "NOTIFICATION_SENT").length;

  const formatEvent = (e: string) => {
    const lower = (e ?? "").toLowerCase();
    if (lower.includes("ticket")) return "Ticket Created";
    if (lower.includes("notification")) return "Notification Sent";
    return e;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow Events</h1>
        <p className="text-sm text-muted-foreground">
          Shows actions executed by Camunda workers
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tickets Created</CardTitle>
            <CardDescription>Count of TICKET_CREATED events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-400">{tickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications Sent</CardTitle>
            <CardDescription>Count of NOTIFICATION_SENT events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-sky-400">{notifications}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event log</CardTitle>
          <CardDescription>Most recent workflow events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center py-8">
                      No workflow events yet. Run predictions with High Risk supplier.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.supplier_id}</TableCell>
                      <TableCell>{formatEvent(e.event_type)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

