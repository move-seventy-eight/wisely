import { getCredentials, getWorkflows } from "@/lib/actions";
import { CredentialsInventoryTable } from "@/components/CredentialsInventoryTable";

export default async function CredentialsPage() {
    const credentials = await getCredentials();
    const allWorkflows = await getWorkflows();

    const workflowsList = allWorkflows.map(w => ({
        id: w.id,
        name: w.name,
        active: w.active,
        riskScore: w.riskScore
    }));

    return (
        <CredentialsInventoryTable
            initialCredentials={credentials}
            workflowsList={workflowsList}
        />
    );
}
