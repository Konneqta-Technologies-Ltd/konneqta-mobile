import * as Contacts from 'expo-contacts';

/**
 * Save a card owner to the phone's address book — natively, no .vcf file
 * (mobile-better than the web's vCard download). Privacy parity with the
 * web vCard route: the phone number is saved ONLY when show_phone is true.
 */
export type SaveContactInput = {
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  phone?: string | null;
  showPhone?: boolean;
  profileUrl: string;
};

export type SaveContactResult = 'saved' | 'denied' | 'error';

export async function saveToContacts(input: SaveContactInput): Promise<SaveContactResult> {
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== Contacts.PermissionStatus.GRANTED) {
    return 'denied';
  }

  const nameParts = input.fullName.trim().split(/\s+/);
  const firstName = nameParts.shift() ?? '';
  const lastName = nameParts.join(' ');

  const contact: Record<string, unknown> = {
    [Contacts.Fields.FirstName]: firstName,
    [Contacts.Fields.LastName]: lastName,
    [Contacts.Fields.UrlAddresses]: [{ label: 'profile', url: input.profileUrl }],
  };

  if (input.jobTitle) contact[Contacts.Fields.JobTitle] = input.jobTitle;
  if (input.company) contact.companyName = input.company; // expo-contacts: the company key is companyName
  if (input.showPhone && input.phone) {
    contact[Contacts.Fields.PhoneNumbers] = [{ label: 'mobile', number: input.phone }];
  }

  try {
    await Contacts.addContactAsync(contact as never);
    return 'saved';
  } catch {
    return 'error';
  }
}
