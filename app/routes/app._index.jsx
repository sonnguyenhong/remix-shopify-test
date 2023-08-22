import { useEffect } from "react";
import { json } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
  Link
} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  VerticalStack,
  Card,
  Button,
  HorizontalStack,
  Box,
  Divider,
  List,
  EmptyState,
  IndexTable,
  Thumbnail,
  Tooltip,
  Icon,
} from "@shopify/polaris";

import { ImageMajor, DiamondAlertMajor } from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import { getQRCodes } from "~/models/QRCode.server";

export const loader = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);

    const QRCodes = await getQRCodes(session.shop, admin.graphql);

    return json({
        QRCodes
    });
};

export async function action({ request }) {
    const { admin } = await authenticate.admin(request);

    const color = ["Red", "Orange", "Yellow", "Green"][
      Math.floor(Math.random() * 4)
    ];
    const response = await admin.graphql(
      `#graphql
        mutation populateProduct($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              handle
              status
              variants(first: 10) {
                edges {
                  node {
                    id
                    price
                    barcode
                    createdAt
                  }
                }
              }
            }
          }
        }`,
      {
        variables: {
          input: {
            title: `${color} Snowboard`,
            variants: [{ price: Math.random() * 100 }],
          },
        },
      }
    );

    const responseJson = await response.json();

    return json({
      product: responseJson.data.productCreate.product,
    });
}

export default function Index() {
    const { QRCodes } = useLoaderData();
    const navigate = useNavigate();

    function truncate(str) {
      const n = 25;
      return str.length > n ? str.substr(0, n - 1) + "…" : str;
    }

    const emptyMarkup = QRCodes.length ? null : (
      <EmptyState
        heading="Create unique QR codes for your product"
        action={{
          content: "Create QR code",
          onAction: () => navigate('/qrcodes/new')
        }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Allow customers to scan codes and buy products using their phones.</p>
      </EmptyState>
    );

    const qrCodesMarkup = QRCodes.length ? (
      <IndexTable
        resourceName={{
          singular: "QR code",
          plural: "QR codes"
        }}
        itemCount={QRCodes.length}
        headings={[
          { title: "Thumbnail", hidden: true },
          { title: "Title" },
          { title: "Product" },
          { title: "Date created" },
          { title: "Scans" },
        ]}
        selectable={false}
      >
        {
          QRCodes.map(
            ({
              id,
              title,
              productImage,
              productTitle,
              productDeleted,
              createdAt,
              scans
            }) => (
              <IndexTable.Row id={id} key={id} position={id}>
                <IndexTable.Cell>
                  <Thumbnail 
                    source={productImage || ImageMajor }
                    alt={"Product image or placeholder"}
                    size="small"
                  />
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Link to={`qrcodes/${id}`}>{truncate(title)}</Link>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {
                    productDeleted ? (
                      <HorizontalStack align="start" gap={"2"}>
                        <Tooltip content="Product has been deleted">
                          <span style={{ width: "20px" }}>
                            <Icon source={DiamondAlertMajor} color="critical" />
                          </span>
                        </Tooltip>
                        <Text color={productDeleted && "critical"} as="span">
                          {truncate(productTitle)}
                        </Text>
                      </HorizontalStack>
                    ) : (
                      truncate(productTitle)
                    )
                  }
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {new Date(createdAt).toDateString()}
                </IndexTable.Cell>
                <IndexTable.Cell>{scans}</IndexTable.Cell>
              </IndexTable.Row>
            )
          )
        }
      </IndexTable>
    ) : null;

    return (
      <Page>
        <ui-title-bar title="QR codes">
          <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
            Create QR Code
          </button>
        </ui-title-bar>
        <Layout>
          <Layout.Section>
            <Card padding={"0"}>
              {emptyMarkup}
              {qrCodesMarkup}
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
}
