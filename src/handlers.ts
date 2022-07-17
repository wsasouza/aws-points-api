import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import * as yup from "yup";

interface IPoints {
  userId: string;
  points: number;
}

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "PointsTable";
const headers = {
  "content-type": "application/json",
};

const schema = yup.object().shape({
  userId: yup.string().required(),
  points: yup.number().required(),  
});

export const addPoints = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const pointsUser: IPoints = {
      ...reqBody,      
    };

    const { userId, points } = pointsUser;    

    const userAlreadyExists = await fetchUserById(userId);

    if (!userAlreadyExists) {
      await docClient
      .put({
        TableName: tableName,
        Item: pointsUser,
      })
      .promise();

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(pointsUser),
      };
    }
 
  } catch (e) {
    return handleError(e);
  }
};

const fetchUserById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        userID: id,
      },
    })
    .promise();

  if (!output.Item) {
    return false;
  }

  return output.Item;
};



class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `invalid request body format : "${e.message}"` }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }

  throw e;
};

export const listPoints = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output.Items),
  };
};

