--
-- PostgreSQL database dump
--

\restrict uz8MnSpl1uXyiCMdzQB5q8M4JYaqqJ9mM2Y50Kvze2cDrbWAb0fgJtXhwkwgY4d

-- Dumped from database version 18.6 (6569466)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: batch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.batch_status AS ENUM (
    'ACTIVE',
    'NEAR_EXPIRY',
    'EXPIRED',
    'RECALLED',
    'QUARANTINED',
    'DEPLETED'
);


--
-- Name: payment_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_direction AS ENUM (
    'PAID_TO_SUPPLIER',
    'RECEIVED_FROM_CUSTOMER'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'UNPAID',
    'PARTIAL',
    'PAID'
);


--
-- Name: purc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purc_type AS ENUM (
    'VAT_EXEMPT',
    'VAT_ITEM_WISE',
    'VAT_TAX_INCL'
);


--
-- Name: purchase_payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_payment_type AS ENUM (
    'CASH',
    'CREDIT',
    'BANK_TRANSFER',
    'CHEQUE',
    'MOBILE_PAYMENT'
);


--
-- Name: purchase_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_return_status AS ENUM (
    'PENDING',
    'COMPLETED'
);


--
-- Name: rounding_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rounding_direction AS ENUM (
    'UP',
    'DOWN'
);


--
-- Name: sale_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sale_return_status AS ENUM (
    'PENDING',
    'COMPLETED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    batch_number character varying(100) NOT NULL,
    manufacturing_date date,
    expiry_date date NOT NULL,
    purchase_price numeric(12,2) NOT NULL,
    mrp numeric(12,2) NOT NULL,
    quantity_received integer NOT NULL,
    quantity_available integer NOT NULL,
    status public.batch_status DEFAULT 'ACTIVE'::public.batch_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    sale_price numeric(12,2),
    note text
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(30),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    address text,
    status boolean DEFAULT true NOT NULL,
    email character varying(255)
);


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    category_id uuid,
    description text,
    amount numeric(12,2) NOT NULL,
    expense_date date NOT NULL,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    note text
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name character varying(255) NOT NULL,
    pan_vat_number character varying(50),
    vat_registered boolean DEFAULT false NOT NULL,
    address text,
    phone character varying(30),
    email character varying(255),
    next_invoice_number integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    logo_url text
);


--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code_hash text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    direction public.payment_direction NOT NULL,
    supplier_id uuid,
    purchase_id uuid,
    customer_id uuid,
    sale_id uuid,
    amount numeric(12,2) NOT NULL,
    payment_date date NOT NULL,
    method character varying(50),
    reference_number character varying(100),
    notes text,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    alias_name character varying(255),
    manufacturer character varying(255),
    category_id uuid,
    hsn_code character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    unit character varying(30) DEFAULT 'Pcs'::character varying NOT NULL,
    alternative_unit character varying(30),
    low_stock_threshold integer,
    stock_quantity integer DEFAULT 0 NOT NULL
);


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_id uuid,
    batch_number character varying(100) NOT NULL,
    manufacturing_date date,
    expiry_date date NOT NULL,
    quantity integer NOT NULL,
    purchase_rate numeric(12,2) NOT NULL,
    mrp numeric(12,2) NOT NULL,
    vat_applicable boolean DEFAULT true NOT NULL,
    line_total numeric(12,2) NOT NULL
);


--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    quantity integer NOT NULL,
    reason character varying(255),
    status public.purchase_return_status DEFAULT 'PENDING'::public.purchase_return_status NOT NULL,
    return_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_invoice_number character varying(100),
    purchase_date date NOT NULL,
    purc_type public.purc_type DEFAULT 'VAT_ITEM_WISE'::public.purc_type NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    freight_charges numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_refund numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    grand_total numeric(12,2) NOT NULL,
    payment_status public.payment_status DEFAULT 'UNPAID'::public.payment_status NOT NULL,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    payment_type public.purchase_payment_type DEFAULT 'CASH'::public.purchase_payment_type NOT NULL,
    rounding_direction public.rounding_direction DEFAULT 'DOWN'::public.rounding_direction NOT NULL,
    round_off numeric(12,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    quantity integer NOT NULL,
    sale_price numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    line_total numeric(12,2) NOT NULL
);


--
-- Name: sale_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    sale_id uuid NOT NULL,
    sale_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    reason character varying(255),
    restocked boolean DEFAULT false NOT NULL,
    status public.sale_return_status DEFAULT 'PENDING'::public.sale_return_status NOT NULL,
    return_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    invoice_number integer NOT NULL,
    customer_id uuid,
    sale_date timestamp without time zone DEFAULT now() NOT NULL,
    payment_status public.payment_status DEFAULT 'UNPAID'::public.payment_status NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    grand_total numeric(12,2) NOT NULL,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    prescription_note text,
    rounding_direction public.rounding_direction DEFAULT 'DOWN'::public.rounding_direction NOT NULL,
    payment_type public.purchase_payment_type DEFAULT 'CASH'::public.purchase_payment_type NOT NULL,
    freight_charges numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_refund numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    round_off numeric(12,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    pan_vat_number character varying(50),
    address text,
    phone character varying(30),
    email character varying(255),
    payment_terms character varying(255),
    status boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    contact_person character varying(255)
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    is_owner boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.batches (id, organization_id, product_id, supplier_id, batch_number, manufacturing_date, expiry_date, purchase_price, mrp, quantity_received, quantity_available, status, created_at, updated_at, sale_price, note) FROM stdin;
30cbc9c3-d2ce-445c-abb8-8f5b7a7cdbba	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	19b48f75-7975-480b-b630-0f3b154abe91	CW2026-09	\N	2028-01-15	5.00	0.00	100	100	ACTIVE	2026-09-23 12:00:25.013385	2026-09-23 12:00:25.013385	\N	\N
6e064d98-5a80-4852-83f8-c9ac4fdba249	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	19b48f75-7975-480b-b630-0f3b154abe91	AS150	2026-10-11	2026-10-08	9.83	150.00	12	11	ACTIVE	2026-09-25 03:09:32.082545	2026-09-27 11:40:56.419	120.00	\N
acd4bb3e-9dca-40ea-babe-56e0bcf3b695	23594875-8665-48bd-9dd0-dae26fb7366b	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	imn340	2026-09-30	2026-09-07	40.40	50.00	1	1	ACTIVE	2026-09-27 11:42:11.18728	2026-09-27 11:42:11.18728	49.90	\N
1be20ff7-d51a-473b-a8fb-4795678b3b62	23594875-8665-48bd-9dd0-dae26fb7366b	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	8a178366-6693-48bd-9ef8-d6e39c459962	bn45	2026-09-26	2026-09-06	50.34	50.00	1	1	ACTIVE	2026-09-27 11:54:42.17604	2026-09-27 11:54:42.17604	29.94	\N
b238401b-5a6f-4f48-b4cd-8fc9bc3b021c	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	#12a3	2026-09-25	2026-01-25	155.45	150.00	10	10	ACTIVE	2026-09-25 04:41:40.58993	2026-09-25 04:41:40.58993	160.00	\N
0c24d3c7-ba28-46a9-b471-654cdef63eff	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	1502	2026-05-26	2027-03-26	150.00	160.00	10	10	ACTIVE	2026-09-26 08:08:47.731043	2026-09-26 08:08:47.731043	160.00	\N
b101efc7-6e7e-4a04-9a6b-c26e15c4cd7d	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	8a178366-6693-48bd-9ef8-d6e39c459962	vvv	2026-09-30	2026-09-01	50.19	50.00	1	1	ACTIVE	2026-09-27 11:56:09.236722	2026-09-27 11:56:09.236722	39.92	\N
c9b461d6-d460-46f0-bd30-85a7cb4c4c2e	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	19b48f75-7975-480b-b630-0f3b154abe91	88	2026-09-29	2026-09-03	13.45	70.00	1	1	ACTIVE	2026-09-27 11:57:14.866863	2026-09-27 11:57:14.866863	70.00	\N
0658ed61-c016-49ee-b35c-3c6422394faf	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	sssss	2026-01-28	2027-11-30	150.00	150.00	100	100	ACTIVE	2026-09-28 03:45:25.988946	2026-09-28 03:45:25.988946	120.00	\N
1a1746a6-815b-4c13-aace-803578b7eddd	23594875-8665-48bd-9dd0-dae26fb7366b	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	8a178366-6693-48bd-9ef8-d6e39c459962	123456	2026-09-28	2026-10-28	12.00	150.00	10	10	ACTIVE	2026-09-28 03:47:37.459147	2026-09-28 03:47:37.459147	200.00	\N
c76ef9c6-2e44-4fa9-b06d-14484d12406f	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	7faf2165-f18b-47e4-a96c-367be9d1eb38	#12578	2028-01-24	2026-04-24	150.00	140.00	80	-70	ACTIVE	2026-09-24 05:01:13.864998	2026-09-26 10:27:06.388	160.00	\N
43ca5e2c-152a-43d5-b654-dc59f3ba4388	23594875-8665-48bd-9dd0-dae26fb7366b	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	ffff	2026-10-02	2026-09-25	140.00	150.00	100	70	ACTIVE	2026-09-25 13:37:31.766472	2026-09-26 12:49:08.328	150.00	hiiiiiiiiiiiiiiiiiiiii
a84d3275-d505-47c0-9536-027ad5013ed8	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	A4789	2027-07-31	2025-12-01	4.30	150.00	451	320	ACTIVE	2026-09-25 13:25:18.789473	2026-09-27 07:36:12.555	120.00	\N
7db7708e-dfb6-4534-a5ab-b776718708c5	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	19b48f75-7975-480b-b630-0f3b154abe91	AE123	2026-09-27	2026-09-26	1.27	150.00	10	8	ACTIVE	2026-09-25 13:34:42.74525	2026-09-27 09:06:35.597	120.00	hii
13f306f5-731d-49bb-813a-4c3d699caf93	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	777bb	2026-10-01	2026-09-15	69.94	67.00	1	1	ACTIVE	2026-09-27 09:49:53.544311	2026-09-27 09:49:53.544311	900.00	\N
840893d0-d511-467f-90cd-ca9332319356	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	#145987	2026-03-23	2027-10-23	10.00	120.00	100	95	ACTIVE	2026-09-23 13:51:38.979604	2026-09-27 10:53:03.57	\N	\N
ef4b7bc2-c9d6-4d9b-9026-6936966dff84	23594875-8665-48bd-9dd0-dae26fb7366b	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	19b48f75-7975-480b-b630-0f3b154abe91	AB2511015	2026-07-01	2027-10-31	8.00	12.00	500	499	ACTIVE	2026-09-23 12:00:25.013385	2026-09-27 10:54:58.261	10.00	\N
3d0da6e0-b136-4bf4-bf94-23aad949340d	23594875-8665-48bd-9dd0-dae26fb7366b	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	19b48f75-7975-480b-b630-0f3b154abe91	788	2026-09-22	2026-09-01	39.91	40.00	1	1	ACTIVE	2026-09-27 11:27:57.077732	2026-09-27 11:27:57.077732	49.91	\N
2fad707a-0f1b-45dc-950c-ab4b346a45dc	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	19b48f75-7975-480b-b630-0f3b154abe91	mm	2026-10-02	2026-09-15	50.21	50.00	1	1	ACTIVE	2026-09-27 11:35:58.556457	2026-09-27 11:35:58.556457	50.06	\N
ced955ce-aaa6-4816-9346-f0a8a244eb9a	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	19b48f75-7975-480b-b630-0f3b154abe91	nn	2026-09-22	2026-09-07	50.34	50.00	1	1	ACTIVE	2026-09-27 11:36:58.277025	2026-09-27 11:36:58.277025	51.00	\N
20baee64-6a5e-483e-969d-0271ba6b522a	23594875-8665-48bd-9dd0-dae26fb7366b	a037fd72-05b5-4fe7-868c-f5354c09e76b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	#1234s4	2026-07-24	2026-10-24	100.00	150.00	70	68	ACTIVE	2026-09-24 04:48:49.58483	2026-09-27 11:40:17.701	160.00	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, organization_id, name, created_at) FROM stdin;
d745ffeb-7b47-4dd8-a97c-2f095b379bef	23594875-8665-48bd-9dd0-dae26fb7366b	medicines	2026-09-23 03:56:13.151778
8362e383-ace5-48e9-8ec9-eabc3b700e96	23594875-8665-48bd-9dd0-dae26fb7366b	vam	2026-09-23 05:43:24.598184
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, organization_id, name, phone, created_at, address, status, email) FROM stdin;
33fcf3b3-eeb5-481d-a735-f60c18048461	23594875-8665-48bd-9dd0-dae26fb7366b	Norvic Hospital	974545982	2026-09-25 10:13:54.861094	Balaju	t	norvic@gmail.com
0183d548-9fbc-462e-a21a-5db53eb6b077	23594875-8665-48bd-9dd0-dae26fb7366b	ruby	984561478	2026-09-25 10:36:11.19118	Balaju	t	test456@gmail.com
07cb268a-b218-48e7-b671-0ae39f0d9fff	23594875-8665-48bd-9dd0-dae26fb7366b	pratha	9876567777	2026-09-27 09:06:12.072462	lalitpur	t	pratha@gmail.com
45e87675-84a8-4272-bae3-3fc189d436c5	23594875-8665-48bd-9dd0-dae26fb7366b	Sujal	9874556247	2026-09-25 06:06:19.640518	Nayabazar	f	sophanshrestha4@gmail.com
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_categories (id, organization_id, name, created_at) FROM stdin;
98016b6d-7a94-44c3-9fdc-443685ec6093	23594875-8665-48bd-9dd0-dae26fb7366b	salary	2026-09-24 07:30:36.277338
b924dd65-19d8-4bc6-b179-081ff9075190	23594875-8665-48bd-9dd0-dae26fb7366b	food	2026-09-24 10:04:34.131576
0a058956-df52-4cad-b797-dbc480b2d510	23594875-8665-48bd-9dd0-dae26fb7366b	Inventory	2026-09-25 03:09:32.0016
b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	23594875-8665-48bd-9dd0-dae26fb7366b	Rent	2026-09-25 10:16:36.374494
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, organization_id, category_id, description, amount, expense_date, created_by_user_id, created_at, note) FROM stdin;
37dcdef2-ce0f-4d43-b4ba-52b563918b69	23594875-8665-48bd-9dd0-dae26fb7366b	b924dd65-19d8-4bc6-b179-081ff9075190	food bill	1000.00	2026-09-24	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-24 10:04:54.812382	\N
46ce8d74-475e-4aae-9cfa-edfaf2adde2d	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice ivv-12540) — Cetirizine 100mg Tablet	120.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 03:09:32.316706	Cetirizine 100mg Tablet — Rs. 9.83/unit × 10 = Rs. 98.30
c28fbf10-a52c-460a-b620-38e00152f3db	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice INV-2025) — Cetirizine 100mg Tablet	1356.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 04:41:40.8416	Cetirizine 100mg Tablet — Rs. 155.45/unit × 10 = Rs. 1554.50
a6ead01e-4583-4f21-b1ed-36702d751ae1	23594875-8665-48bd-9dd0-dae26fb7366b	b924dd65-19d8-4bc6-b179-081ff9075190	lunch	1500.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:16:18.279328	\N
3e82e4d9-b6da-4ff4-a9ff-387cb08924c4	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	pay a rent	15000.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:16:50.190429	\N
9cb50a45-a8e2-4bea-baea-58279e542baa	23594875-8665-48bd-9dd0-dae26fb7366b	b924dd65-19d8-4bc6-b179-081ff9075190	Dinner	4500.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:17:21.787177	\N
84229eef-97d6-4d47-8062-df899a922540	23594875-8665-48bd-9dd0-dae26fb7366b	98016b6d-7a94-44c3-9fdc-443685ec6093	paid the rent to ram	1540.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:17:55.544842	\N
3c059186-1222-4d3f-95ce-c9cc76d9b2d9	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	paid the rent	15000.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:18:28.285398	\N
570b6879-765b-4af2-8b95-2a5a203f06c1	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	by a paramol of rs 300	12000.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:33:43.601886	\N
259725cd-40b5-472b-9f5f-37bab16d97e0	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	paid to bibek	1000.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 10:34:46.873634	\N
55409411-a9d2-4a9c-a852-48cc09c16ada	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	A rent	1400.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 11:04:16.565481	\N
0a8465a7-2275-4e9b-8963-e9942ecaf01f	23594875-8665-48bd-9dd0-dae26fb7366b	98016b6d-7a94-44c3-9fdc-443685ec6093	add the salary	1400.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 11:05:57.252035	\N
a070b685-cdb6-4694-a839-da34c0de413c	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice INV-7894) — Cetirizine 100mg Tablet	2090.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:25:19.033995	Cetirizine 100mg Tablet — Rs. 4.30/unit × 451 = Rs. 1939.30
b9a2ed48-75cc-432a-9317-7da791cf08c2	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice 45712) — Cetirizine 100mg Tablet	165.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:34:43.013062	Cetirizine 100mg Tablet — Rs. 1.27/unit × 10 = Rs. 12.70
b9ccbfbc-5933-4a6d-971b-4988016ef871	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice inbvr) — dolpar 200mg	14000.00	2026-09-25	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:37:32.002143	dolpar 200mg — Rs. 140.00/unit × 100 = Rs. 14000.00
aabf9211-e3eb-46ce-836c-83cf509f0bae	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice lllll) — Cetirizine 100mg Tablet	3067.00	2026-09-26	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 08:08:47.969846	Cetirizine 100mg Tablet — Rs. 150.00/unit × 10 = Rs. 1500.00
5e8be117-accd-4e81-8925-cd08f8105bb2	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	paid	5000.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 08:11:01.013141	\N
1970ebcf-2381-4253-b1e1-a28231adb71c	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice 56000) — Cetirizine 100mg Tablet	120.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 09:49:54.105872	Cetirizine 100mg Tablet — Rs. 69.94/unit × 1 = Rs. 69.94
50a253ba-99e2-492c-8ff1-2368aa9853f0	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice 44444) — dolpar 200mg	89.91	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:27:57.401633	dolpar 200mg — Rs. 39.91/unit × 1 = Rs. 39.91
267db80f-33f3-4233-b594-f0fcec366a24	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice inv300) — Paracetamol 500mg Tablet	51.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:35:59.098706	Paracetamol 500mg Tablet — Rs. 50.21/unit × 1 = Rs. 50.21
18540ab7-24ec-4b03-b319-ee9bb964afb4	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice mm33) — Paracetamol 500mg Tablet	51.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:36:58.79012	Paracetamol 500mg Tablet — Rs. 50.34/unit × 1 = Rs. 50.34
9aea2ee3-64a3-42b9-a55f-3908a3349ca0	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice inc) — dolpar 200mg	40.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:42:11.504884	dolpar 200mg — Rs. 40.40/unit × 1 = Rs. 40.40
abe7554c-90ba-43ed-95ae-c752fb83e90e	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice inv40) — dolpar 200mg	20.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:54:43.22597	dolpar 200mg — Rs. 50.34/unit × 1 = Rs. 50.34
76e967b9-48e3-4ba5-a56b-247a4a9b1e1b	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice inv) — Paracetamol 500mg Tablet	20.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:56:09.655009	Paracetamol 500mg Tablet — Rs. 50.19/unit × 1 = Rs. 50.19
b01c72f8-0ca9-4d6f-8f9a-b3f98189ae99	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice 7) — Paracetamol 500mg Tablet	13.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:57:15.214478	Paracetamol 500mg Tablet — Rs. 13.45/unit × 1 = Rs. 13.45
cfb07cf7-536c-47cc-9b7c-edc1b2e6955f	23594875-8665-48bd-9dd0-dae26fb7366b	b9a03f3f-3d60-42ae-b8a1-497a3b05d5dd	paid to sham	1500.00	2026-09-27	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 15:31:08.398085	paid to sham
9a8a860a-8547-468f-8c93-c36f4671e4da	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice Inv32) — Cetirizine 100mg Tablet	14650.00	2026-09-28	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-28 03:45:26.240841	Cetirizine 100mg Tablet — Rs. 150.00/unit × 100 = Rs. 15000.00
61714566-9152-4d4d-a663-15db9d0f703b	23594875-8665-48bd-9dd0-dae26fb7366b	0a058956-df52-4cad-b797-dbc480b2d510	Purchase (Invoice INV234) — dolpar 200mg	120.00	2026-09-28	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-28 03:47:37.700424	dolpar 200mg — Rs. 12.00/unit × 10 = Rs. 120.00
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, business_name, pan_vat_number, vat_registered, address, phone, email, next_invoice_number, created_at, updated_at, logo_url) FROM stdin;
23594875-8665-48bd-9dd0-dae26fb7366b	pharmacy	301234567	t	Kathmandu, Nepal	981356478	info@citypharmacy.com	14	2026-09-22 05:01:53.746229	2026-09-28 06:19:00.066	https://res.cloudinary.com/dba000dkc/image/upload/v1790575161/pharma-system/organizations/23594875-8665-48bd-9dd0-dae26fb7366b/logo.avif
\.


--
-- Data for Name: password_resets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_resets (id, user_id, code_hash, verified, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, organization_id, direction, supplier_id, purchase_id, customer_id, sale_id, amount, payment_date, method, reference_number, notes, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, organization_id, name, alias_name, manufacturer, category_id, hsn_code, is_active, description, created_at, updated_at, unit, alternative_unit, low_stock_threshold, stock_quantity) FROM stdin;
a037fd72-05b5-4fe7-868c-f5354c09e76b	23594875-8665-48bd-9dd0-dae26fb7366b	Paracetamol 500mg Tablet	Acetaminophen 500mg	Nepal Pharmaceuticals	d745ffeb-7b47-4dd8-a97c-2f095b379bef	30049099	t	Paracetamol 500mg tablets used for the temporary relief of fever and mild to moderate pain.	2026-09-23 04:56:37.395447	2026-09-27 11:57:15.124	Pcs	Box	100	97
1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	23594875-8665-48bd-9dd0-dae26fb7366b	Cetirizine 100mg Tablet	Cetirizine Hydrochloride 200mg	Nepal Pharmaceuticals	d745ffeb-7b47-4dd8-a97c-2f095b379bef	30049099	t	Cetirizine 10mg tablets used to relieve symptoms of allergies such as sneezing, runny nose, and itching.	2026-09-23 04:58:21.517308	2026-09-28 03:45:27.881	Bottle	Strip	40	1057
07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	23594875-8665-48bd-9dd0-dae26fb7366b	dolpar 200mg	dolpar	Apex Healthcare	d745ffeb-7b47-4dd8-a97c-2f095b379bef	3004	t	\N	2026-09-25 12:45:01.212777	2026-09-28 03:47:39.348	Tab	\N	120	85
\.


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_items (id, purchase_id, product_id, batch_id, batch_number, manufacturing_date, expiry_date, quantity, purchase_rate, mrp, vat_applicable, line_total) FROM stdin;
414fdee3-9c9b-481a-807a-de6df4b96400	75821949-07cb-443f-89f1-7b832d9ae7a6	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	ef4b7bc2-c9d6-4d9b-9026-6936966dff84	AB2511015	2026-07-01	2027-10-31	500	8.00	12.00	t	4000.00
34be6e58-e0e2-4a01-b81b-a26be99e5bfc	75821949-07cb-443f-89f1-7b832d9ae7a6	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	30cbc9c3-d2ce-445c-abb8-8f5b7a7cdbba	CW2026-09	\N	2028-01-15	100	5.00	0.00	f	500.00
865e172b-1e4d-47c5-8459-7e35eafd5eed	65faa578-ada0-4ba2-9227-ae593cc0b15b	a037fd72-05b5-4fe7-868c-f5354c09e76b	840893d0-d511-467f-90cd-ca9332319356	#145987	2026-03-23	2027-10-23	100	10.00	120.00	t	1000.00
343ec565-10aa-4121-b8d4-fea10f25e7a7	65faa578-ada0-4ba2-9227-ae593cc0b15b	a037fd72-05b5-4fe7-868c-f5354c09e76b	20baee64-6a5e-483e-969d-0271ba6b522a	#1234s4	2026-07-24	2026-10-24	70	100.00	150.00	t	7000.00
16a069e0-76cf-4226-9110-3931d86ac2d9	4c30f0e9-f27d-4159-91c2-2084ae63cb9a	a037fd72-05b5-4fe7-868c-f5354c09e76b	c76ef9c6-2e44-4fa9-b06d-14484d12406f	#12578	2028-01-24	2026-04-24	80	150.00	140.00	f	12000.00
123eb7c4-acd7-47d6-a6f2-1e0052f56535	317e440f-fd98-4cfd-b511-d90fa59c8453	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	b238401b-5a6f-4f48-b4cd-8fc9bc3b021c	#12a3	2026-09-25	2026-01-25	10	155.45	150.00	t	1554.50
4699bd63-6998-4597-a956-dcac9135839e	b50eef3d-1321-4de9-b8f3-5c883545631f	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	a84d3275-d505-47c0-9536-027ad5013ed8	A4789	2027-07-31	2025-12-01	451	4.30	150.00	t	1939.30
ac458fe7-4f26-444e-8586-31ff85245e53	d8bf8f41-b5a2-4525-baf6-97b4a68fd2e4	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	7db7708e-dfb6-4534-a5ab-b776718708c5	AE123	2026-09-27	2026-09-26	10	1.27	150.00	t	12.70
3cb55e3e-8adb-49e4-97b2-6439651c6825	b31c2926-145e-4d5d-815b-59d6ca6dd289	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	6e064d98-5a80-4852-83f8-c9ac4fdba249	AS150	2026-10-11	2026-10-08	12	9.83	150.00	t	117.96
310782c9-e5e3-4d11-95f5-4ebdb2559ced	2780fede-c780-4ce1-9d7a-c120ff4459a2	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	43ca5e2c-152a-43d5-b654-dc59f3ba4388	ffff	2026-10-02	2026-09-25	100	140.00	150.00	t	14000.00
dc8c53ab-ca26-4983-be81-86c7da49dd1b	22d9c749-3fa5-45a3-80df-480af123e180	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	0c24d3c7-ba28-46a9-b471-654cdef63eff	1502	2026-05-26	2027-03-26	10	150.00	160.00	t	1500.00
ae8febec-6d48-4cc8-be95-4d8fd13cb2f9	a55d8c94-7833-42c1-845d-363495a047d4	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	13f306f5-731d-49bb-813a-4c3d699caf93	777bb	2026-10-01	2026-09-15	1	69.94	67.00	t	69.94
7ca2ae76-d541-4d2f-8e1d-e43699201c55	1ff1984d-c174-42e0-8543-92e2fdfc02bd	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	3d0da6e0-b136-4bf4-bf94-23aad949340d	788	2026-09-22	2026-09-01	1	39.91	40.00	t	39.91
329885bc-2ba7-48dd-9753-9291d7b272c9	d7296c22-37e5-4e66-be4d-34d197f44252	a037fd72-05b5-4fe7-868c-f5354c09e76b	2fad707a-0f1b-45dc-950c-ab4b346a45dc	mm	2026-10-02	2026-09-15	1	50.21	50.00	t	50.21
92f37bb1-962a-4cde-9a0b-97783622564e	ff47a5db-e7bf-4683-b8da-ebfcf1691ec4	a037fd72-05b5-4fe7-868c-f5354c09e76b	ced955ce-aaa6-4816-9346-f0a8a244eb9a	nn	2026-09-22	2026-09-07	1	50.34	50.00	t	50.34
cedf146e-cf6e-43be-b5aa-8059073b97a2	63429ddc-c203-4575-b2a8-10ce20ebb2a9	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	acd4bb3e-9dca-40ea-babe-56e0bcf3b695	imn340	2026-09-30	2026-09-07	1	40.40	50.00	t	40.40
5c822f80-f5ad-477f-a473-339c1acdda13	b41aca85-b2f9-447c-9381-a23015a374d9	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	1be20ff7-d51a-473b-a8fb-4795678b3b62	bn45	2026-09-26	2026-09-06	1	50.34	50.00	t	50.34
7c729197-d719-44e3-9a86-eb0b8a4fe63d	ea000a83-0463-4204-a05d-e159645e4a73	a037fd72-05b5-4fe7-868c-f5354c09e76b	b101efc7-6e7e-4a04-9a6b-c26e15c4cd7d	vvv	2026-09-30	2026-09-01	1	50.19	50.00	t	50.19
a0a08408-e582-4431-bf34-5a443977293e	acb40d40-3d58-4c62-9463-3290f75797f4	a037fd72-05b5-4fe7-868c-f5354c09e76b	c9b461d6-d460-46f0-bd30-85a7cb4c4c2e	88	2026-09-29	2026-09-03	1	13.45	70.00	t	13.45
e6097afa-da02-4aab-88f9-7b2458e821e5	00aeeccc-9dcd-403b-a10e-8c926aeaccd0	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	0658ed61-c016-49ee-b35c-3c6422394faf	sssss	2026-01-28	2027-11-30	100	150.00	150.00	t	15000.00
7cce31b1-6975-42b2-ba7d-7bc0221c0e47	f1be2dc2-3227-4479-80f8-c7b6f65373af	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	1a1746a6-815b-4c13-aace-803578b7eddd	123456	2026-09-28	2026-10-28	10	12.00	150.00	t	120.00
\.


--
-- Data for Name: purchase_returns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_returns (id, organization_id, supplier_id, batch_id, quantity, reason, status, return_date, created_at) FROM stdin;
\.


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchases (id, organization_id, supplier_id, supplier_invoice_number, purchase_date, purc_type, subtotal, discount, freight_charges, vat_amount, vat_refund, grand_total, payment_status, created_by_user_id, created_at, payment_type, rounding_direction, round_off) FROM stdin;
75821949-07cb-443f-89f1-7b832d9ae7a6	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	INV-2201	2026-09-20	VAT_ITEM_WISE	4500.00	100.00	50.00	520.00	0.00	4970.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-23 12:00:24.61238	CASH	DOWN	0.00
65faa578-ada0-4ba2-9227-ae593cc0b15b	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	123564	2026-09-23	VAT_EXEMPT	8000.00	500.00	100.00	0.00	0.00	7600.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-23 13:51:38.602615	CASH	DOWN	0.00
4c30f0e9-f27d-4159-91c2-2084ae63cb9a	23594875-8665-48bd-9dd0-dae26fb7366b	7faf2165-f18b-47e4-a96c-367be9d1eb38	INV-7486	2026-09-24	VAT_EXEMPT	12000.00	500.00	1502.00	0.00	0.00	13002.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-24 05:01:13.544878	CASH	DOWN	0.00
2780fede-c780-4ce1-9d7a-c120ff4459a2	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	inbvr	2026-09-25	VAT_EXEMPT	14000.00	0.00	0.00	0.00	0.00	14000.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:37:31.434762	CASH	UP	0.00
317e440f-fd98-4cfd-b511-d90fa59c8453	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	INV-2025	2026-09-25	VAT_ITEM_WISE	1554.50	500.00	100.00	202.09	0.00	1356.59	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 04:41:40.239646	CASH	DOWN	0.00
b50eef3d-1321-4de9-b8f3-5c883545631f	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	INV-7894	2026-09-25	VAT_EXEMPT	1939.30	0.00	150.00	0.00	0.00	2089.30	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:25:18.412475	CASH	UP	0.00
d8bf8f41-b5a2-4525-baf6-97b4a68fd2e4	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	45712	2026-09-25	VAT_ITEM_WISE	12.70	0.00	150.00	1.65	0.00	164.35	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 13:34:42.358644	CASH	UP	0.00
b31c2926-145e-4d5d-815b-59d6ca6dd289	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	ivv-12540	2026-09-25	VAT_TAX_INCL	117.96	0.00	10.00	13.57	0.00	141.53	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-25 03:09:31.654424	CASH	DOWN	0.00
22d9c749-3fa5-45a3-80df-480af123e180	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	lllll	2026-09-26	VAT_EXEMPT	1500.00	0.00	1567.81	0.00	0.00	3067.81	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 08:08:47.387898	CASH	DOWN	0.00
a55d8c94-7833-42c1-845d-363495a047d4	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	56000	2026-09-27	VAT_EXEMPT	69.94	0.00	50.70	0.00	0.00	120.64	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 09:49:52.948271	CASH	DOWN	0.00
1ff1984d-c174-42e0-8543-92e2fdfc02bd	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	44444	2026-09-27	VAT_EXEMPT	39.91	0.00	50.00	0.00	0.00	89.91	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:27:56.577745	CASH	DOWN	0.00
d7296c22-37e5-4e66-be4d-34d197f44252	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	inv300	2026-09-27	VAT_EXEMPT	50.21	0.00	0.00	0.00	0.00	51.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:35:57.783892	CASH	UP	0.79
ff47a5db-e7bf-4683-b8da-ebfcf1691ec4	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	mm33	2026-09-27	VAT_EXEMPT	50.34	0.00	0.00	0.00	0.00	51.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:36:57.742593	CASH	UP	0.66
63429ddc-c203-4575-b2a8-10ce20ebb2a9	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	inc	2026-09-27	VAT_EXEMPT	40.40	0.00	0.00	0.00	0.00	40.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:42:10.622783	CASH	DOWN	-0.40
b41aca85-b2f9-447c-9381-a23015a374d9	23594875-8665-48bd-9dd0-dae26fb7366b	8a178366-6693-48bd-9ef8-d6e39c459962	inv40	2026-09-27	VAT_EXEMPT	50.34	30.00	0.00	0.00	0.00	20.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:54:40.165785	CASH	DOWN	-0.34
ea000a83-0463-4204-a05d-e159645e4a73	23594875-8665-48bd-9dd0-dae26fb7366b	8a178366-6693-48bd-9ef8-d6e39c459962	inv	2026-09-27	VAT_EXEMPT	50.19	30.00	0.00	0.00	0.00	20.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:56:08.524093	CASH	DOWN	-0.19
acb40d40-3d58-4c62-9463-3290f75797f4	23594875-8665-48bd-9dd0-dae26fb7366b	19b48f75-7975-480b-b630-0f3b154abe91	7	2026-09-27	VAT_EXEMPT	13.45	0.00	0.00	0.00	0.00	13.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:57:14.288529	CASH	DOWN	-0.45
00aeeccc-9dcd-403b-a10e-8c926aeaccd0	23594875-8665-48bd-9dd0-dae26fb7366b	b6a72436-b6a8-4a58-a40b-b96c8a31cb89	Inv32	2026-09-28	VAT_EXEMPT	15000.00	500.00	150.00	0.00	0.00	14650.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-28 03:45:25.61345	CASH	DOWN	0.00
f1be2dc2-3227-4479-80f8-c7b6f65373af	23594875-8665-48bd-9dd0-dae26fb7366b	8a178366-6693-48bd-9ef8-d6e39c459962	INV234	2026-09-28	VAT_EXEMPT	120.00	0.00	0.00	0.00	0.00	120.00	UNPAID	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-28 03:47:37.134618	CASH	DOWN	0.00
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sale_items (id, sale_id, product_id, batch_id, quantity, sale_price, vat_amount, line_total) FROM stdin;
1a20ad9b-237d-4db2-abaa-925d759cb7a9	5764bd02-7a5f-4f54-a44c-dad5d71fbe95	a037fd72-05b5-4fe7-868c-f5354c09e76b	c76ef9c6-2e44-4fa9-b06d-14484d12406f	80	160.00	0.00	12800.00
f96323c5-c623-4eef-854a-8203690f5a29	5764bd02-7a5f-4f54-a44c-dad5d71fbe95	a037fd72-05b5-4fe7-868c-f5354c09e76b	c76ef9c6-2e44-4fa9-b06d-14484d12406f	70	160.00	0.00	11200.00
ba588fcf-bf5d-4e32-8e60-b9bad657e756	a76c2315-b260-44a7-8b0b-065e9d678f2e	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	a84d3275-d505-47c0-9536-027ad5013ed8	10	120.00	0.00	1200.00
d8907f0f-6112-4bb1-93a2-21c108684669	381edd2d-fd5f-4b12-9c85-f372850c108f	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	a84d3275-d505-47c0-9536-027ad5013ed8	120	120.00	0.00	14400.00
116a90f2-da8c-4763-b7c6-42bdc689bc1c	4c8f5cb1-0050-40e1-8f0a-59420ef7a06e	07f2d03f-bdf7-4015-b1b7-6cc04f4183b6	43ca5e2c-152a-43d5-b654-dc59f3ba4388	30	150.00	0.00	4500.00
ff2da13c-11e7-4ebf-8752-ac26cfde70ca	81c1a962-4fea-453f-b5a9-5842a53321db	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	a84d3275-d505-47c0-9536-027ad5013ed8	1	120.00	0.00	120.00
5ee03d95-627d-4451-9281-87b3354568b5	04dbc916-edaf-4ea0-bd75-8f8ca274c9b0	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	7db7708e-dfb6-4534-a5ab-b776718708c5	1	120.00	0.00	120.00
bfdb720a-3932-4d80-946e-7aff8bd7a152	2666c9a1-bb7c-4462-919e-c077eef5e710	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	7db7708e-dfb6-4534-a5ab-b776718708c5	1	120.00	0.00	120.00
8981b8c1-a2fa-49fd-aae7-3584f0fa5250	b3bebe1c-0b64-45f5-81ea-c9573417315a	a037fd72-05b5-4fe7-868c-f5354c09e76b	20baee64-6a5e-483e-969d-0271ba6b522a	1	160.90	0.00	160.90
313c417e-7167-4613-a8f9-4fd6c37a1bf3	f67ba7c9-9939-4057-81f0-23fe450f2a22	a037fd72-05b5-4fe7-868c-f5354c09e76b	840893d0-d511-467f-90cd-ca9332319356	1	119.85	0.00	119.85
87056283-9549-43de-af8a-68d4574b508d	51e39d06-45e9-4e76-8e0b-417aaa1b916c	a037fd72-05b5-4fe7-868c-f5354c09e76b	840893d0-d511-467f-90cd-ca9332319356	4	120.00	0.00	480.00
810aa3e0-5ecc-42a5-8d62-b3054a8accdd	5bc53e2d-cb09-4b2c-b52d-7d5bb3b07b32	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	ef4b7bc2-c9d6-4d9b-9026-6936966dff84	1	10.00	0.00	10.00
4d1aaad4-04aa-4387-ae4a-ec3dbe1f8390	33f0b9ad-9f17-4513-921a-82b0b45a3422	a037fd72-05b5-4fe7-868c-f5354c09e76b	20baee64-6a5e-483e-969d-0271ba6b522a	1	160.00	0.00	160.00
c6f469d9-3f8f-40d1-9108-803bf547472c	49b4e47d-741c-497c-8f02-e12b0fcbc7c4	1b0fb6b1-fc18-485e-bee1-4569f1fac2ec	6e064d98-5a80-4852-83f8-c9ac4fdba249	1	29.89	0.00	29.89
\.


--
-- Data for Name: sale_returns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sale_returns (id, organization_id, sale_id, sale_item_id, quantity, reason, restocked, status, return_date, created_at) FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales (id, organization_id, invoice_number, customer_id, sale_date, payment_status, subtotal, discount, vat_amount, grand_total, created_by_user_id, created_at, prescription_note, rounding_direction, payment_type, freight_charges, vat_refund, round_off) FROM stdin;
5764bd02-7a5f-4f54-a44c-dad5d71fbe95	23594875-8665-48bd-9dd0-dae26fb7366b	2	33fcf3b3-eeb5-481d-a735-f60c18048461	2026-09-26 00:00:00	UNPAID	24000.00	0.00	3120.00	27120.00	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 10:16:43.875565	\N	UP	CASH	0.00	0.00	0.00
a76c2315-b260-44a7-8b0b-065e9d678f2e	23594875-8665-48bd-9dd0-dae26fb7366b	1	45e87675-84a8-4272-bae3-3fc189d436c5	2026-09-26 00:00:00	UNPAID	1200.00	0.00	156.00	1356.00	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 10:13:42.661713	\N	DOWN	CASH	0.00	0.00	0.00
381edd2d-fd5f-4b12-9c85-f372850c108f	23594875-8665-48bd-9dd0-dae26fb7366b	3	33fcf3b3-eeb5-481d-a735-f60c18048461	2026-09-26 00:00:00	PAID	14400.00	50.00	1872.00	16222.00	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 10:22:53.472385	\N	DOWN	CASH	0.00	0.00	0.00
4c8f5cb1-0050-40e1-8f0a-59420ef7a06e	23594875-8665-48bd-9dd0-dae26fb7366b	4	0183d548-9fbc-462e-a21a-5db53eb6b077	2026-09-26 00:00:00	UNPAID	4500.00	0.00	585.00	5085.00	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-26 12:49:06.053585	take	DOWN	CASH	0.00	0.00	0.00
04dbc916-edaf-4ea0-bd75-8f8ca274c9b0	23594875-8665-48bd-9dd0-dae26fb7366b	6	\N	2026-09-27 00:00:00	UNPAID	120.00	0.00	15.60	135.60	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 08:45:39.782635	\N	DOWN	CASH	0.00	0.00	0.00
2666c9a1-bb7c-4462-919e-c077eef5e710	23594875-8665-48bd-9dd0-dae26fb7366b	7	07cb268a-b218-48e7-b671-0ae39f0d9fff	2026-09-27 00:00:00	UNPAID	120.00	0.00	15.60	135.60	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 09:06:35.44259	\N	DOWN	CASH	0.00	0.00	0.00
b3bebe1c-0b64-45f5-81ea-c9573417315a	23594875-8665-48bd-9dd0-dae26fb7366b	8	07cb268a-b218-48e7-b671-0ae39f0d9fff	2026-09-27 00:00:00	UNPAID	160.90	0.00	0.00	160.90	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 09:53:33.136183	\N	DOWN	CASH	0.00	0.00	0.00
f67ba7c9-9939-4057-81f0-23fe450f2a22	23594875-8665-48bd-9dd0-dae26fb7366b	9	33fcf3b3-eeb5-481d-a735-f60c18048461	2026-09-27 00:00:00	UNPAID	119.85	0.00	15.58	135.43	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 09:54:21.990866	\N	DOWN	CASH	0.00	0.00	0.00
5bc53e2d-cb09-4b2c-b52d-7d5bb3b07b32	23594875-8665-48bd-9dd0-dae26fb7366b	11	\N	2026-09-27 00:00:00	UNPAID	10.00	0.00	1.30	11.30	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 10:54:57.700648	\N	DOWN	CASH	0.00	0.00	0.00
51e39d06-45e9-4e76-8e0b-417aaa1b916c	23594875-8665-48bd-9dd0-dae26fb7366b	10	\N	2026-09-27 00:00:00	UNPAID	480.00	0.00	62.40	542.40	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 10:53:02.971979	\N	DOWN	CASH	0.00	0.00	0.00
33f0b9ad-9f17-4513-921a-82b0b45a3422	23594875-8665-48bd-9dd0-dae26fb7366b	12	\N	2026-09-27 00:00:00	UNPAID	160.00	0.00	20.80	245.23	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:40:17.399299	\N	DOWN	CASH	64.43	0.00	0.00
49b4e47d-741c-497c-8f02-e12b0fcbc7c4	23594875-8665-48bd-9dd0-dae26fb7366b	13	\N	2026-09-27 00:00:00	UNPAID	29.89	0.00	0.00	30.00	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 11:40:56.014837	\N	UP	CASH	0.00	0.00	0.11
81c1a962-4fea-453f-b5a9-5842a53321db	23594875-8665-48bd-9dd0-dae26fb7366b	5	\N	2026-09-27 00:00:00	UNPAID	120.00	0.00	15.60	135.60	9dec9201-12e9-4e03-af38-6af06df28249	2026-09-27 07:36:12.332656	\N	UP	CASH	0.00	0.00	0.00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, refresh_token_hash, expires_at, created_at) FROM stdin;
f83bc509-6cca-41a8-a247-d75136756e68	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$PtcxmxZ2La8AC0Kw0k58wOCPl5CjJKmV195ghJ4V8oLHwf93NAR82	2026-09-29 07:16:23.959	2026-09-22 07:16:22.369919
0f16bac7-85de-418e-9099-bc9ffe92da74	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$6SXOUt9iTTEpxigMqz5f/ueFXIYeRjO72pfGc.N57/.Wp.1Xf0oA6	2026-09-29 07:18:06.963	2026-09-22 07:18:05.36246
d2c0c7ac-356c-41b1-8287-4db319108631	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$YG0Bci6CXKWnsV2PSuHP1u1Bq4buFDW8oEQm6wYjyRSolRQk5EMby	2026-09-29 09:40:07.12	2026-09-22 09:40:05.653392
b6fa3716-deda-4da9-b4c6-d7f56bc066fb	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$mqP8b7Mfom9GIn9.Vy7i7Om7xO03YTjJY22MnN1UzJhR1VokDbvz6	2026-09-29 09:41:00.101	2026-09-22 09:40:58.626752
86e796e8-6f26-487e-98f6-22aec386adcd	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$hvmIFvyPRzycEKAtYqQ2vuVYJjxEj2NnlOhXUp/k3IepXBIf7.kDq	2026-09-30 08:22:49.42	2026-09-23 08:22:48.860312
a3ef514d-6153-417d-a35a-7c16665bb5d8	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$ykgRTGbMdBF56LgWWvmoQuhp0Kx2Bkmb4f6TTUl371YcBDLp8HSUa	2026-10-05 06:59:08.943	2026-09-28 06:36:30.056818
e4cc1def-8ac5-42ec-8652-36ec3278fa17	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$RMKujkSIJG0sE38BlevNleQQzSe4YFDW0OAt4AcRbT9A1jo4VbOFG	2026-09-29 09:43:50.538	2026-09-22 09:41:28.711823
16676829-d3df-4c67-b266-b904ae46e0e0	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$th0SWG3lnhY9kAg0MUO0XuJsq3CBVYfsPMWPImTyc7jcmkMsHdpYq	2026-09-29 09:44:44.321	2026-09-22 09:44:42.848073
d8bbc8a7-4a85-4a44-b402-fc74d105cb43	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$QoH3iuvebGDWQGY/jGtV9O6Gwzltpra7ikMXI58mEziVFeLqm.vH6	2026-09-30 13:41:43.614	2026-09-23 13:14:46.111012
7020c5f6-d52b-4c34-914e-b37ef35d003a	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$0dbmc1O9tFZDgKo4l0ik2.dze0v73rjFrxcS/EAN0vFPLLh6UAc8G	2026-10-01 09:25:54.107	2026-09-24 07:27:33.730342
be9e844b-e55a-4f55-9109-25ded97d4947	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$yaUeUhRu2SCiOU.AziQ/y.vwjkY3mv54GhJnPaLuYhRHpKN8.Xyle	2026-10-02 06:05:16.946	2026-09-25 06:05:15.522818
2ea00ec2-90da-401c-83d6-46c99e7d9025	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$bAZgFNzATxgk9qxt/KyC/eACncJLO8WEnCg0E21d83ZbmvAAgCyC2	2026-09-30 03:50:44.846	2026-09-23 03:50:43.285689
7c16e77b-a6f8-4cce-84b9-5cd59d2d4bc5	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$5vCQu0bM7gPwdOpr0EphbOlmWB4HfHigAwLWQGSuntKmRq9C4Oxqa	2026-10-04 13:36:50.827	2026-09-27 13:36:50.5571
f7d2759f-8732-4dc4-8648-6b5d8084a873	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$ucuhOj9pTA6Co4zDT916TeM4ivK4T36lLvBe8r3E1x.Q3BZprHKHK	2026-09-30 04:56:00.798	2026-09-23 03:55:48.998721
91f71e3c-8bd2-4161-9d2f-df131676fb40	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$HFh2KG4uPNTGZ.GFMRr6R.qGLcbYLOZgl1SvSnHgU1kN6.5CSWVBW	2026-10-02 06:12:55.795	2026-09-25 06:09:01.93121
d895965c-7865-4d1b-952a-134967507d47	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$z7CQJIeGBtUTHt8w5rcQ2OeZJRxoXo3OdhxvNL25P0oZElWRsz3QK	2026-10-04 09:44:00.453	2026-09-27 09:44:00.618487
fbbf299c-cf8d-498d-a520-74fb2869a278	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$67J7G8grp1gnA4dC1UH7N.MdEkYbf75cd/r7teFcIc7IBUzlfsSUW	2026-09-30 12:20:50.485	2026-09-23 11:01:08.58654
1eb845f1-6aac-4c9b-9a59-cfb87c8c35ea	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$S5tGL/tBOsq.ADdbO/RBDu.qqJZH1Y7SKZFC.QE3UhWQVowt7uTWC	2026-10-05 07:11:28.43	2026-09-28 05:27:38.409097
954adf44-85b8-41c1-a871-1e89cffd2ea2	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$IHnZ3Dnsz9M3xuIM6h.QrO1gw8XKmDIvWUKhiCfDWggrGZ1pGkfKu	2026-10-02 11:53:31.14	2026-09-24 11:04:09.303211
24de3688-7bdb-456c-bc3d-212576f6eb29	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$aTzpkowpl/oBmj5dOf9HXerto5tciaEJ.7VK4/UKUluoCgBoGPiUW	2026-10-04 11:45:28.533	2026-09-27 09:44:08.620347
e0198e21-5ed1-494b-a27d-8ca09f5ef1e3	9dec9201-12e9-4e03-af38-6af06df28249	$2b$12$CgYAIMX8j2ESbJ.C4QhRXeXPIAin4KdZTe45d4Hhjd5/GeNK6yjtO	2026-10-05 05:12:35.901	2026-09-28 03:21:46.142827
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, organization_id, name, pan_vat_number, address, phone, email, payment_terms, status, notes, created_at, contact_person) FROM stdin;
8a178366-6693-48bd-9ef8-d6e39c459962	23594875-8665-48bd-9dd0-dae26fb7366b	Sophan	30112547	Nayabazar	984568712	sophanshrestha@gmail.com	\N	t	\N	2026-09-25 12:39:18.939491	sophan
7faf2165-f18b-47e4-a96c-367be9d1eb38	23594875-8665-48bd-9dd0-dae26fb7366b	MedSupply Pvt. Ltd.	600223344	Putalisadak, Kathmandu	9841000002	contact@medsupply.com.np	Net 15	f	\N	2026-09-23 07:19:59.892883	Sujal
19b48f75-7975-480b-b630-0f3b154abe91	23594875-8665-48bd-9dd0-dae26fb7366b	CG	301254	patan	987456214	prijal@gmail.com	\N	t	\N	2026-09-23 09:10:45.919592	Prizal
b6a72436-b6a8-4a58-a40b-b96c8a31cb89	23594875-8665-48bd-9dd0-dae26fb7366b	ABC Distributors	600112233	New Road, Kathmandu	9841000001	sales@abcdistributors.com.np	Net 30	t	\N	2026-09-23 07:19:59.892883	Sophan
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, organization_id, name, email, password_hash, is_owner, created_at) FROM stdin;
9dec9201-12e9-4e03-af38-6af06df28249	23594875-8665-48bd-9dd0-dae26fb7366b	Sophan shrestha	owner@gmail.com	$2b$12$x7AymhvAMBZ5SwrGDYalMecBQ5cBSo9lkjpK8QSoXscW2CJf1NTFu	t	2026-09-22 05:01:54.036059
\.


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_returns sale_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: batches_org_batch_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batches_org_batch_number_idx ON public.batches USING btree (organization_id, batch_number);


--
-- Name: batches_product_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batches_product_expiry_idx ON public.batches USING btree (product_id, expiry_date);


--
-- Name: products_alias_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_alias_name_idx ON public.products USING btree (alias_name);


--
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- Name: sales_org_invoice_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_org_invoice_number_idx ON public.sales USING btree (organization_id, invoice_number);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: batches batches_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: batches batches_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: batches batches_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: categories categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: customers customers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: expense_categories expense_categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_category_id_expense_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_expense_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: password_resets password_resets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: payments payments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payments payments_purchase_id_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_purchase_id_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: payments payments_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: payments payments_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: purchase_items purchase_items_purchase_id_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE RESTRICT;


--
-- Name: purchase_returns purchase_returns_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: purchases purchases_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: purchases purchases_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_returns sale_returns_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sale_returns sale_returns_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE RESTRICT;


--
-- Name: sale_returns sale_returns_sale_item_id_sale_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_sale_item_id_sale_items_id_fk FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id) ON DELETE RESTRICT;


--
-- Name: sales sales_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales sales_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: sales sales_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict uz8MnSpl1uXyiCMdzQB5q8M4JYaqqJ9mM2Y50Kvze2cDrbWAb0fgJtXhwkwgY4d

