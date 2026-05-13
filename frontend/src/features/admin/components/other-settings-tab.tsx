import { ShieldCheck } from "lucide-react";
import { WorkspacePanel } from "@/components/layout/workspace-ui";
import { MailSettingsForm } from "../settings/mail-settings-form";
import { DomainPolicyForm } from "../settings/domain-policy-form";
import { DeliveryTestPanel, type DeliveryTestDiagnosticState } from "./delivery-test-panel";
import type {
  DomainPolicySettings,
  MailDeliverySettings,
  MailInboundSettings,
  MailSMTPSettings,
} from "../settings/types";

type OtherSettingsTabProps = {
  smtp: MailSMTPSettings;
  delivery: MailDeliverySettings;
  inbound: MailInboundSettings;
  domainPolicy: DomainPolicySettings;
  onSMTPChange: (next: MailSMTPSettings) => void;
  onDeliveryChange: (next: MailDeliverySettings) => void;
  onInboundChange: (next: MailInboundSettings) => void;
  onDomainPolicyChange: (next: DomainPolicySettings) => void;
  deliveryTestRecipient: string;
  onDeliveryTestRecipientChange: (value: string) => void;
  isTestPending: boolean;
  onSendDeliveryTest: () => void;
  deliveryTestDiagnostic: DeliveryTestDiagnosticState;
};

export function OtherSettingsTab({
  smtp,
  delivery,
  inbound,
  domainPolicy,
  onSMTPChange,
  onDeliveryChange,
  onInboundChange,
  onDomainPolicyChange,
  deliveryTestRecipient,
  onDeliveryTestRecipientChange,
  isTestPending,
  onSendDeliveryTest,
  deliveryTestDiagnostic,
}: OtherSettingsTabProps) {
  return (
    <div className="grid gap-4">
      <WorkspacePanel
        title="Text"
        description="Text SMTP Text、Text。"
      >
        <MailSettingsForm
          smtp={smtp}
          delivery={delivery}
          inbound={inbound}
          onSMTPChange={onSMTPChange}
          onDeliveryChange={onDeliveryChange}
          onInboundChange={onInboundChange}
          mode="smtp"
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Text"
        description="Text、Text SMTP。"
      >
        <MailSettingsForm
          smtp={smtp}
          delivery={delivery}
          inbound={inbound}
          onSMTPChange={onSMTPChange}
          onDeliveryChange={onDeliveryChange}
          onInboundChange={onInboundChange}
          mode="delivery"
        />
        <DeliveryTestPanel
          recipient={deliveryTestRecipient}
          onRecipientChange={onDeliveryTestRecipientChange}
          isPending={isTestPending}
          onSendTest={onSendDeliveryTest}
          diagnosticState={deliveryTestDiagnostic}
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Text"
        description="Text raw Text、Text、catch-all Text。"
      >
        <MailSettingsForm
          smtp={smtp}
          delivery={delivery}
          inbound={inbound}
          onSMTPChange={onSMTPChange}
          onDeliveryChange={onDeliveryChange}
          onInboundChange={onInboundChange}
          mode="inbound"
        />
      </WorkspacePanel>

      <WorkspacePanel
        title="Text"
        description="Text。"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-muted-foreground" />
          DomainText
        </div>
        <DomainPolicyForm
          value={domainPolicy}
          onChange={onDomainPolicyChange}
        />
      </WorkspacePanel>
    </div>
  );
}
