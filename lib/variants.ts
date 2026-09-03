export const NPS_VARIANTS: { id: number; text: string }[] = [
  { id: 0, text: "How likely are you to recommend <displayName> to a friend?" },
  { id: 1, text: "How likely is it that you would recommend <displayName> to a friend?" },
  { id: 2, text: "How likely is it that you would recommend <displayName> to a colleague?" },
  { id: 3, text: "How likely is it that you would recommend <displayName> to a family member?" },
  { id: 4, text: "How likely is it that you would recommend <displayName> to someone else?" },
  { id: 5, text: "How likely is it that you would recommend <displayName> to a friend or colleague?" },
  { id: 6, text: "How likely is it that you would shop at <displayName> in the future?" },
  { id: 7, text: "How likely is it that you would recommend <displayName>?" },
  { id: 8, text: "Would you recommend <displayName> to a friend or colleague?" },
  { id: 9, text: "How likely are you to recommend your experience with <displayName> to a friend?" },
];

export const CSAT_VARIANTS: { id: number; text: string }[] = [
  { id: 0, text: "What is your overall satisfaction with <displayName>?" },
  { id: 1, text: "How satisfied are you with <displayName>?" },
  { id: 2, text: "Overall, how satisfied were you with your recent <displayName> experience?" },
  { id: 3, text: "How would you rate the overall experience with <displayName>?" },
  { id: 4, text: "How would you rate your overall experience with <displayName>?" },
  { id: 5, text: "How would you rate your experience so far with <displayName>?" },
  { id: 6, text: "How would you rate your experience on Twitter with <displayName>?" },
  { id: 7, text: "Were you satisfied with your recent experience with <displayName>?" },
  { id: 8, text: "How well does <displayName> meet your expectations?" },
  { id: 9, text: "How would you rate your guest experience with <displayName>?" },
  { id: 10, text: "How would you rate your service experience with <displayName>?" },
  { id: 11, text: "How would you rate your recent service experience with <displayName>?" },
  { id: 12, text: "How would you rate the service you received from <displayName>?" },
  { id: 13, text: "Were you satisfied with the result of your interaction with <displayName>?" },
  { id: 14, text: "How would you rate the ability to resolve your issue with <displayName>?" },
  { id: 15, text: "How would you rate the response time from <displayName>?" },
  { id: 16, text: "How would you rate the speed of service from <displayName>?" },
  { id: 17, text: "How would you rate the time to resolution with <displayName>?" },
  { id: 18, text: "How would you rate the time to resolve your issue with <displayName>?" },
  { id: 19, text: "How would you rate the speed of resolution with <displayName>?" },
  { id: 20, text: "How would you rate the <displayName> advisor's expertise?" },
  { id: 21, text: "How satisfied were you with the <displayName> agent who helped you?" },
  { id: 22, text: "How satisfied were you with the <displayName> specialist who helped you?" },
  { id: 23, text: "How satisfied were you with the <displayName> representative who helped you?" },
  { id: 24, text: "How would you rate your recent banking experience with <displayName>?" },
  { id: 25, text: "How would you rate the overall event experience at <displayName>?" },
  { id: 26, text: "How would you rate your bill pay experience with <displayName>?" },
  { id: 27, text: "How would you rate your purchase experience with <displayName>?" },
  { id: 28, text: "How would you rate your shopping experience with <displayName>?" },
  { id: 29, text: "How would you rate your delivery experience with <displayName>?" },
  { id: 30, text: "How would you rate your rental experience with <displayName>?" },
  { id: 31, text: "How would you rate your recent <displayName> store visit?" },
  { id: 32, text: "How would you rate your recent <displayName> hotel stay?" },
  { id: 33, text: "How would you rate your recent flight with <displayName>?" },
  { id: 34, text: "How would you rate your recent ride with <displayName>?" },
  { id: 35, text: "How would you rate your recent trip with <displayName>?" },
  { id: 36, text: "How would you rate your recent visit to <displayName>?" },
  { id: 37, text: "How would you rate your recent meal at <displayName>?" },
];

export function questionText(
  type: "nps" | "csat",
  variantId: number,
  displayName: string,
): string {
  const list = type === "nps" ? NPS_VARIANTS : CSAT_VARIANTS;
  const match = list.find((item) => item.id === variantId) ?? list[0];
  return match.text.replaceAll("<displayName>", displayName || "this business");
}
