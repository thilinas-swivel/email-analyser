import { Client } from "@microsoft/microsoft-graph-client";
import { Email, UserProfile } from "./types";

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function getUserProfile(accessToken: string): Promise<UserProfile> {
  const client = getGraphClient(accessToken);
  const user = await client
    .api("/me")
    .select("displayName,mail,jobTitle,officeLocation")
    .get();
  
  let photo: string | undefined;
  try {
    const photoBlob = await client.api("/me/photo/$value").get();
    const buffer = await photoBlob.arrayBuffer();
    photo = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    // No photo available
  }

  return { ...user, photo };
}

export async function getUnreadEmails(
  accessToken: string,
  top: number = 200
): Promise<Email[]> {
  const client = getGraphClient(accessToken);
  const result = await client
    .api("/me/messages")
    .filter("isRead eq false")
    .select(
      "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance,categories,hasAttachments,conversationId,flag"
    )
    .orderby("receivedDateTime desc")
    .top(top)
    .get();

  return result.value;
}

export async function getAllRecentEmails(
  accessToken: string,
  startDate: Date,
  endDate: Date,
  top: number = 1000
): Promise<Email[]> {
  const client = getGraphClient(accessToken);
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const allEmails: Email[] = [];
  let nextLink: string | undefined;
  const pageSize = Math.min(top, 250);

  const firstPage = await client
    .api("/me/messages")
    .filter(`receivedDateTime ge ${startStr} and receivedDateTime le ${endStr}`)
    .select(
      "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance,categories,hasAttachments,conversationId,flag,body"
    )
    .orderby("receivedDateTime desc")
    .top(pageSize)
    .get();

  allEmails.push(...firstPage.value);
  nextLink = firstPage["@odata.nextLink"];

  while (nextLink && allEmails.length < top) {
    const nextPage = await client.api(nextLink).get();
    allEmails.push(...nextPage.value);
    nextLink = nextPage["@odata.nextLink"];
  }

  return allEmails.slice(0, top);
}

export async function getSentEmails(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<Email[]> {
  const client = getGraphClient(accessToken);
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const result = await client
    .api("/me/mailFolders/sentItems/messages")
    .filter(`sentDateTime ge ${startStr} and sentDateTime le ${endStr}`)
    .select("id,subject,toRecipients,conversationId,sentDateTime")
    .orderby("sentDateTime desc")
    .top(1000)
    .get();

  return result.value;
}
