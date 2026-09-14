import { Link } from "wouter";
import { LegalPage, Points, Section, ToConfirm } from "@/components/LegalPage";

// The Terms of Service — a DRAFT pending legal review.
//
// Like the Privacy Policy, it describes the platform as it really is: accounts
// are made by the school (nobody can sign themselves up), a parent's view is
// read-only, and a pupil's first sign-in uses a code from their teacher.
export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" testId="page-terms-of-service">
      <p>
        These terms are the rules for using the On Point Homework &amp; Learning Portal ("the platform"),
        run by On Point Education Centre ("the school", "we"). By signing in, you agree to them. For a
        pupil, their parent or guardian is responsible for helping them follow these rules.
      </p>

      <Section heading="1. Who may use the platform">
        <p>Only these people may use the platform:</p>
        <Points>
          <li><strong>Pupils</strong> enrolled at the school.</li>
          <li><strong>Parents and guardians</strong> of those pupils, to see their own child's work and progress.</li>
          <li><strong>School staff</strong>, to teach, mark and look after pupils.</li>
        </Points>
        <p>Nobody else may use it. Access ends when a pupil leaves the school or a member of staff stops working there.</p>
      </Section>

      <Section heading="2. Your account">
        <Points>
          <li>
            <strong>Accounts are provided by the school.</strong> You cannot create one yourself. The school
            creates pupil and parent accounts, and a teacher gives a new pupil a one-time code for their
            first sign-in.
          </li>
          <li><strong>Keep your password private.</strong> Do not share it, and do not use anyone else's account.</li>
          <li>If you think someone else knows your password, change it and tell the school.</li>
          <li>The school may reset, switch off or delete an account — for example when a pupil leaves, or if these rules are broken.</li>
          <li>A parent's account is for viewing only. It cannot change work, marks or anything else.</li>
        </Points>
      </Section>

      <Section heading="3. Using the platform properly">
        <p><strong>Please do:</strong></p>
        <Points>
          <li>Hand in your own work, honestly.</li>
          <li>Be respectful in anything you write or upload.</li>
        </Points>
        <p><strong>Do not:</strong></p>
        <Points>
          <li>Sign in as someone else, or try to see another person's information.</li>
          <li>Share other pupils' information — their names, work or marks — outside the platform.</li>
          <li>Upload anything harmful, offensive or illegal, anything that is not yours to share, or photos of other people without their permission.</li>
          <li>Try to break, overload or get around the platform's security. If you find a problem, tell the school instead.</li>
          <li>Try to cheat marks, rewards or games — for example by changing your device's clock.</li>
          <li>Use the platform for advertising, or for anything that is not to do with school.</li>
        </Points>
        <p>
          If these rules are broken, the school may switch off the account involved and deal with it under the
          school's own behaviour policies.
        </p>
      </Section>

      <Section heading="4. Your work">
        <p>
          Homework and anything a pupil uploads remains the pupil's own work. The school uses it to mark,
          give feedback and follow the pupil's progress. Lessons, resources and questions provided by
          teachers belong to the school or to their original owners, and are for use on the platform only.
        </p>
      </Section>

      <Section heading="5. The service">
        <p>
          The school provides the platform to support learning. We work to keep it running, but it may
          sometimes be unavailable, and we may change or improve it. Keep your own copy of anything
          important.
        </p>
      </Section>

      <Section heading="6. Responsibility for misuse">
        <p>
          The school provides the platform in good faith. As far as the law allows, the school is not liable
          for loss or harm caused by misuse of the platform — for example by someone sharing their password,
          using another person's account, or uploading something they should not.
        </p>
        <p>Nothing in these terms takes away any responsibility the school has that cannot be limited by law.</p>
      </Section>

      <Section heading="7. Privacy">
        <p>
          How the platform handles personal information is explained in our{" "}
          <Link href="/privacy" className="underline font-semibold">Privacy Policy</Link>.
        </p>
      </Section>

      <Section heading="8. Changes and contact">
        <p>
          If we change these terms, we will update this page and tell users about any important change.
          Questions about these terms: <ToConfirm>the school's contact email or phone number</ToConfirm>
        </p>
        <p className="text-sm text-muted-foreground">
          Draft prepared 14 September 2026. Takes effect: <ToConfirm>the date, once legal review is complete</ToConfirm>.
          Applicable law: <ToConfirm>for legal review</ToConfirm>.
        </p>
      </Section>
    </LegalPage>
  );
}
