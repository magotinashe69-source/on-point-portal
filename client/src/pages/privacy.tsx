import { Link } from "wouter";
import { LegalPage, Points, Section, ToConfirm } from "@/components/LegalPage";

// The Privacy Policy — a DRAFT pending legal review.
//
// Every statement here was checked against what the platform actually does,
// and it must stay that way: a privacy policy that promises something the code
// does not do is worse than none. Things worth knowing before editing it:
//
//  * There is NO attendance register. The QR "attendance card" is only used to
//    sign in, so the policy says that rather than listing attendance as data.
//  * Parents' phone numbers and email addresses are NOT stored. A parent
//    account is a name, a username, a password and the child it is linked to.
//  * There is exactly ONE cookie: the login cookie (connect.sid, httpOnly,
//    24 hours — server/index.ts). If that ever changes, section 7 must too.
//  * The page itself loads fonts from Google, and lesson videos come from
//    YouTube's no-cookie player. Both are named, because both are requests to
//    a company outside the school.
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" testId="page-privacy-policy">
      <p>
        This policy explains what information the On Point Homework &amp; Learning Portal
        ("the platform") keeps, why, who can see it, and how it is looked after. The platform is
        run by On Point Education Centre ("the school", "we"). It applies to pupils, their parents
        or guardians, and school staff.
      </p>

      <Section heading="1. What information we keep">
        <p><strong>About pupils</strong></p>
        <Points>
          <li>Their full name, gender, student number and class.</li>
          <li>The code printed on their QR sign-in card, if they have one.</li>
          <li>Their homework: the answers they type, and any photos or files they upload, such as a photo of handwritten work.</li>
          <li>Their marks, their teacher's feedback, report-card grades and teacher comments.</li>
          <li>Their progress: the skills they have shown, points, homework streaks, certificates, and the game plays they have earned and used.</li>
          <li>When each piece of work was handed in.</li>
        </Points>
        <p>
          <strong>Attendance.</strong> The platform does not keep an attendance register. The QR
          "attendance card" is used only to sign in. Where the platform shows "days active on
          homework", that counts the days work was handed in — not the days a pupil was in school.
        </p>

        <p><strong>About parents and guardians</strong></p>
        <Points>
          <li>Their name, a username, and which child their account is linked to.</li>
          <li>
            We do not store parents' phone numbers or email addresses on the platform. When the school
            sends a parent a weekly report, for example by WhatsApp, it does so from the school's own
            records, outside the platform.
          </li>
        </Points>

        <p><strong>About school staff</strong></p>
        <Points>
          <li>Their name and work email address.</li>
        </Points>

        <p><strong>For everyone</strong></p>
        <Points>
          <li>A password, stored scrambled (see section 5).</li>
          <li>Basic technical records the server keeps to run safely, such as which address was asked for, when, and whether it worked.</li>
        </Points>
      </Section>

      <Section heading="2. Why we keep it">
        <Points>
          <li><strong>Homework</strong> — so teachers can set work and pupils can hand it in, including without a signal.</li>
          <li><strong>Marking</strong> — so work can be marked and pupils can read their feedback.</li>
          <li><strong>Progress tracking</strong> — reports, report cards, certificates, the skills map, and the games that reward finished homework.</li>
          <li><strong>School communication</strong> — announcements, and keeping parents informed about their own child.</li>
          <li><strong>Keeping accounts safe</strong> — so only the right people can sign in.</li>
        </Points>
        <p>We do not use this information for advertising, and we do not sell it.</p>
      </Section>

      <Section heading="3. Who can see it">
        <Points>
          <li><strong>The pupil</strong> can see their own homework, marks, feedback and progress — not anyone else's.</li>
          <li>
            <strong>Teachers and school administrators</strong> can see the information of the pupils
            they teach and look after, so they can set work, mark it and support pupils. Staff may be
            able to open a pupil's account to see exactly what the pupil sees.
          </li>
          <li>
            <strong>The pupil's own parent or guardian</strong> can see their own child's work, marks,
            feedback and progress, and the announcements for that child's class. They cannot see any
            other child, and they cannot change anything.
          </li>
        </Points>
        <p>
          <strong>No one else outside the school</strong> can see it, except where the law requires us
          to share it. The companies that host the platform store the information on the school's behalf
          and may not use it for anything else. <ToConfirm>the names of the hosting companies</ToConfirm>
        </p>
      </Section>

      <Section heading="4. Outside services the pages use">
        <Points>
          <li>
            <strong>Google Fonts.</strong> The platform's lettering is loaded from Google. When a page
            opens, the device asks Google for the fonts, so Google receives that device's internet address.
            No pupil information is sent to Google.
          </li>
          <li>
            <strong>YouTube.</strong> When a teacher adds a YouTube video to a lesson, it is shown through
            YouTube's "privacy-enhanced" player (youtube-nocookie.com). YouTube only receives anything when
            that video is played.
          </li>
        </Points>
      </Section>

      <Section heading="5. How we protect it">
        <Points>
          <li>
            <strong>Passwords are stored scrambled.</strong> We keep a scrambled ("hashed") version that
            cannot be turned back into the password. A password saved before this protection was added is
            scrambled the next time its owner signs in.
          </li>
          <li>
            <strong>Everything is behind a secure login.</strong> Each person sees only what their role
            allows, and repeated wrong passwords are blocked for a few minutes.
          </li>
          <li><strong>Connections use HTTPS</strong>, so information is encrypted on its way between your device and the platform.</li>
          <li>A new pupil's first sign-in needs a one-time code from their teacher, so nobody else can claim their account.</li>
        </Points>
        <p>No system can be made perfectly secure, but we work to keep this information safe and to fix problems quickly.</p>
      </Section>

      <Section heading="6. Cookies and what is kept on your device">
        <p>
          The platform uses <strong>one cookie</strong>: a login cookie. It keeps you signed in as you
          move between pages. It ends when you log out, or after 24 hours at most, and scripts on the page
          cannot read it.
        </p>
        <p>We do <strong>not</strong> use cookies for advertising, analytics or tracking.</p>
        <p>The platform also keeps a few things in your browser's own storage. These are not cookies, and they stay on your device:</p>
        <Points>
          <li>Who is signed in on this device, so the page opens in the right place. Logging out clears it.</li>
          <li>Your choice of language, and of light or dark screen.</li>
          <li>Homework saved for working without a signal, until it has been sent to the school.</li>
        </Points>
        <p>Clearing your browser's data for this site removes all of these.</p>
      </Section>

      <Section heading="7. How long we keep it">
        <p>
          We keep a pupil's information while they are enrolled. When a pupil leaves, the school can switch
          their account off, which stops anyone signing in but keeps the record, or delete it. Deleting a
          pupil removes their homework, marks, progress and their parent's account.
        </p>
        <p>
          <ToConfirm>how long records are kept after a pupil leaves, and how long backup copies are kept</ToConfirm>
        </p>
      </Section>

      <Section heading="8. Seeing and correcting your child's information">
        <p>
          A parent or guardian can ask the school to see the information we hold about their child, and to
          correct anything that is wrong. You can also ask us to delete it, where the law allows. Anyone
          with an account can change their own password at any time.
        </p>
        <p>
          To ask, contact the school: <ToConfirm>the school's contact email or phone number, and how quickly we will reply</ToConfirm>
        </p>
      </Section>

      <Section heading="9. Children">
        <p>
          The platform is used by children. Pupils' and parents' accounts are created by the school, not by
          the children themselves, and we keep only the information needed to teach and to keep families
          informed.
        </p>
      </Section>

      <Section heading="10. Changes to this policy">
        <p>
          If we change this policy, we will update this page and tell parents about any important change.
          See also our <Link href="/terms" className="underline font-semibold">Terms of Service</Link>.
        </p>
        <p className="text-sm text-muted-foreground">
          Draft prepared 14 September 2026. Takes effect: <ToConfirm>the date, once legal review is complete</ToConfirm>.
          Applicable law: <ToConfirm>for legal review</ToConfirm>.
        </p>
      </Section>
    </LegalPage>
  );
}
