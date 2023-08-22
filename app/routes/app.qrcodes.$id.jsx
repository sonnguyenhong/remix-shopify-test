import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "@remix-run/react";
import { Bleed, Button, Card, ChoiceList, Divider, EmptyState, HorizontalStack, InlineError, Layout, Page, PageActions, Text, TextField, Thumbnail, VerticalStack } from "@shopify/polaris";
import { ImageMajor } from "@shopify/polaris-icons"
import { useState } from "react";
import { getQRCode, validateQRCode } from "~/models/QRCode.server";
import { authenticate } from "~/shopify.server";

import db from "../db.server";

// Remix loader to load data to component/page
export async function loader({ request, params }) {
    const { admin } = await authenticate.admin(request);

    if(params.id === "new") {
        return json({
            destination: "product",
            title: ""
        })
    }

    return json(await getQRCode(Number(params.id), admin.graphql));
}

export async function action({ request, params }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    if(request.method === "DELETE") {
        await db.qRCode.delete({ where: { id: Number(params.id) } });
        return redirect("/app");
    }

    const data = {
        ...Object.fromEntries(await request.formData()),
        shop,
    };

    console.log("QR Code created data: ", data);
    
    const errors = validateQRCode(data);

    if(errors) {
        return json({ errors }, { status: 422 });
    }
    
    const QRCode = params.id === "new" ? await db.qRCode.create({ data }) : await db.qRCode.update({ where: { id: Number(params.id) }, data });
    return redirect(`/app/qrcodes/${QRCode.id}`);
}

export default function QRCodeForm() {
    const errors = useActionData()?.errors || {};   // This is the return value of "validateQRCode, which is accessed through the Remix useActionData hook"
    const QRCode = useLoaderData();                 
    const navigate = useNavigate();                 
    const nav = useNavigation();
    const [formState, setFormState] = useState(QRCode); // The state is copied from useLoaderData into React state
    const [cleanFormState, setCleanFormState] = useState(QRCode);   // Initial state of form
    
    const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);   // check if the form has changed
    const isSaving = nav.state === "submitting" && nav.formMethod === "POST";       // Keep track of network state using useNavigation(). This state is used to disable button and show loading state
    const isDeleting = nav.state === "submitting" && nav.formMethod === "DELETE";   // Keep track of network state using useNavigation(). This state is used to disable button and show loading state
    
    const submit = useSubmit();
    function handleSave() {
        const data = {
            title: formState.title,
            productId: formState.productId || "",
            productVariantId: formState.productVariantId || "",
            productHandle: formState.productHandle || "",
            destination: formState.destination,
        };
        
        setCleanFormState({ ...formState });
        submit(data, { method: "post" });
    }

    async function selectProduct() {
        const products = await window.shopify.resourcePicker({
            type: "product",
            action: "select"
        });

        if(products) {
            const { images, id, variants, title, handle } = products[0];
            setFormState({
                ...formState,
                productId: id,
                productVariantId: variants[0].id,
                productTitle: title,
                productHandle: handle,
                productAlt: images[0]?.altText || "",
                productImage: images[0]?.originalSrc,
            });
        }
    }

    return (
        <Page>
            <ui-title-bar title={QRCode ? "Edit QR code" : "Create new QR code"}>
                <button variant="breadcrumb" onClick={() => navigate('/app')}>
                    QR codes
                </button>
            </ui-title-bar>
            <Layout>
                <Layout.Section>
                    <VerticalStack gap="5">
                        <Card>
                            <VerticalStack gap="5">
                                <Text as={"h2"} variant="headingLg">
                                    Title
                                </Text>
                                <TextField 
                                    id="title"
                                    helpText="Only store staff can see this title"
                                    label="title"
                                    labelHidden
                                    autoComplete="off"
                                    value={formState.title}
                                    onChange={(title) => setFormState({ ...formState, title: title })}
                                    error={errors.title}
                                />
                            </VerticalStack>
                        </Card>
                        <Card>
                            <VerticalStack gap="5">
                                <HorizontalStack align="space-between">
                                    <Text as="h2" variant="headingLg"> 
                                        Product
                                    </Text>
                                    {
                                        formState.productId ? (
                                            <Button plain onClick={selectProduct}>
                                                Change product
                                            </Button>
                                        ) : null
                                    }
                                </HorizontalStack>
                                {
                                    formState.productId ? (
                                        <HorizontalStack blockAlign="center" gap={"5"}>
                                            <Thumbnail 
                                                source={formState.productImage || ImageMajor }
                                                alt={formState.productAlt}
                                            />
                                            <Text as="span" variant="headingMd" fontWeight="semibold">
                                                {formState.productTitle}
                                            </Text>
                                        </HorizontalStack>
                                    ) : (
                                        <VerticalStack>
                                            <Button onClick={selectProduct} id="select-product">
                                                Select product
                                            </Button>
                                            {
                                                errors.productId ? (
                                                    <InlineError message={errors.productId} fieldID="myFieldID" />
                                                ) : null
                                            }
                                        </VerticalStack>
                                    )
                                }
                                <Bleed marginInline="20">
                                    <Divider />
                                </Bleed>
                                <HorizontalStack
                                    gap={"5"}
                                    align="space-between"
                                    blockAlign="start"
                                >
                                    <ChoiceList
                                        title="Scan destination"
                                        choices={[
                                            { label: "Link to product page", value: "product" },
                                            {
                                                label: "Link to checkout page with product in the cart",
                                                value: "cart"
                                            }
                                        ]}
                                        selected={[formState.destination]}
                                        onChange={(destination) => {
                                            setFormState({
                                                ...formState,
                                                destination: destination[0],
                                            })
                                        }}
                                        error={errors.destination}
                                    />
                                    {
                                        QRCode.destinationUrl ? (
                                            <Button plain url={QRCode.destinationUrl} external>
                                                Go to destination URL
                                            </Button>
                                        ) : null
                                    }
                                </HorizontalStack>
                            </VerticalStack>
                        </Card>
                    </VerticalStack>
                </Layout.Section>
                <Layout.Section secondary> 
                    <Card>
                        <Text as={"h2"} variant="headingLg">
                            QR code
                        </Text>
                        {
                            QRCode ? (
                                <EmptyState image={QRCode.image} imageContained={true} />
                            ) : (
                                <EmptyState image="">
                                    Your QR code will appear hear after you save
                                </EmptyState>
                            )
                        }
                        <VerticalStack gap={"3"}>
                            <Button
                                disabled={!QRCode?.image}
                                url={QRCode?.image}
                                download
                                primary
                            >
                                Download
                            </Button>
                            <Button
                                disabled={!QRCode.id}
                                url={`/qrcodes/${QRCode.id}`}
                                external
                            >
                                Go to public URL
                            </Button>
                        </VerticalStack>
                    </Card>
                </Layout.Section>
                <Layout.Section>
                    <PageActions 
                        secondaryActions={[
                            {
                                content: "Delete",
                                loading: isDeleting,
                                disabled: !QRCode.id || !QRCode || isSaving || isDeleting,
                                destructive: true,
                                outline: true,
                                onAction: () => submit({}, { method: "delete" })
                            },
                        ]}
                        primaryAction={{
                            content: "Save",
                            loading: isSaving,
                            disabled: !isDirty || isSaving || isDeleting,
                            onAction: handleSave,
                        }}
                    />
                </Layout.Section>
            </Layout>
        </Page>
    );
}