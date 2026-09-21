--
-- PostgreSQL database dump
--

\restrict Mx1foTMhqxmCt1Ck5cDTdEKsU5Tf2eryKDEi6kjrZwjFqXLladSIbfVNeXPaVS0

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: role_utilisateur; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_utilisateur AS ENUM (
    'CLIENT',
    'VENDEUR',
    'ADMIN'
);


--
-- Name: statut_boutique; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.statut_boutique AS ENUM (
    'EN_ATTENTE',
    'VERIFIEE',
    'SUSPENDUE'
);


--
-- Name: statut_commande; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.statut_commande AS ENUM (
    'EN_ATTENTE',
    'VALIDEE',
    'EN_COURS_DE_LIVRAISON',
    'LIVREE',
    'ANNULEE'
);


--
-- Name: statut_stock; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.statut_stock AS ENUM (
    'EN_STOCK',
    'RUPTURE'
);


--
-- Name: type_notification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.type_notification AS ENUM (
    'COMMANDE',
    'MESSAGE',
    'BOUTIQUE',
    'SYSTEME'
);


--
-- Name: create_boutique_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_boutique_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO statistiques_vendeurs (boutique_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: avis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avis (
    id integer NOT NULL,
    client_id integer NOT NULL,
    boutique_id integer NOT NULL,
    note integer NOT NULL,
    commentaire text,
    date_avis timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT avis_note_check CHECK (((note >= 1) AND (note <= 5)))
);


--
-- Name: avis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.avis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.avis_id_seq OWNED BY public.avis.id;


--
-- Name: boutiques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutiques (
    id integer NOT NULL,
    vendeur_id integer NOT NULL,
    nom_boutique character varying(150) NOT NULL,
    logo character varying(255),
    description text,
    quartier character varying(100) NOT NULL,
    point_repere character varying(255),
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    contact_whatsapp character varying(20) NOT NULL,
    statut public.statut_boutique DEFAULT 'EN_ATTENTE'::public.statut_boutique,
    horaire_ouverture character varying(100),
    est_ouvert boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: boutiques_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boutiques_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boutiques_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boutiques_id_seq OWNED BY public.boutiques.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    icone character varying(255)
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    utilisateur_id integer NOT NULL,
    adresse_residence character varying(255),
    latitude double precision,
    longitude double precision
);


--
-- Name: commandes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commandes (
    id integer NOT NULL,
    code_commande character varying(50) NOT NULL,
    client_id integer NOT NULL,
    date_commande timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_livraison_prevue date,
    lieu_livraison character varying(255) NOT NULL,
    statut public.statut_commande DEFAULT 'EN_ATTENTE'::public.statut_commande,
    montant_total numeric(10,2) NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT commandes_montant_total_check CHECK ((montant_total >= (0)::numeric))
);


--
-- Name: commandes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commandes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commandes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commandes_id_seq OWNED BY public.commandes.id;


--
-- Name: discussions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussions (
    id integer NOT NULL,
    client_id integer NOT NULL,
    vendeur_id integer NOT NULL,
    date_creation timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: discussions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discussions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discussions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discussions_id_seq OWNED BY public.discussions.id;


--
-- Name: lignes_de_commande; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_de_commande (
    id integer NOT NULL,
    commande_id integer,
    panier_id integer,
    produit_id integer NOT NULL,
    quantite integer NOT NULL,
    prix_unitaire numeric(10,2) NOT NULL,
    CONSTRAINT chk_destination CHECK ((((commande_id IS NOT NULL) AND (panier_id IS NULL)) OR ((commande_id IS NULL) AND (panier_id IS NOT NULL)))),
    CONSTRAINT lignes_de_commande_prix_unitaire_check CHECK ((prix_unitaire >= (0)::numeric)),
    CONSTRAINT lignes_de_commande_quantite_check CHECK ((quantite > 0))
);


--
-- Name: lignes_de_commande_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lignes_de_commande_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lignes_de_commande_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lignes_de_commande_id_seq OWNED BY public.lignes_de_commande.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    discussion_id integer NOT NULL,
    expediteur_id integer NOT NULL,
    contenu text NOT NULL,
    horodatage timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    est_lu boolean DEFAULT false
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    utilisateur_id integer NOT NULL,
    type public.type_notification NOT NULL,
    titre character varying(150) NOT NULL,
    message text NOT NULL,
    est_lue boolean DEFAULT false,
    lien_action character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: paniers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paniers (
    id integer NOT NULL,
    client_id integer NOT NULL,
    montant_total numeric(10,2) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: paniers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.paniers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paniers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.paniers_id_seq OWNED BY public.paniers.id;


--
-- Name: produits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produits (
    id integer NOT NULL,
    boutique_id integer NOT NULL,
    categorie_id integer NOT NULL,
    nom character varying(150) NOT NULL,
    description text,
    prix numeric(10,2) NOT NULL,
    photos text[],
    disponible boolean DEFAULT true,
    statut_stock public.statut_stock DEFAULT 'EN_STOCK'::public.statut_stock,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT produits_prix_check CHECK ((prix >= (0)::numeric))
);


--
-- Name: produits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.produits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: produits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.produits_id_seq OWNED BY public.produits.id;


--
-- Name: statistiques_vendeurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statistiques_vendeurs (
    boutique_id integer NOT NULL,
    nb_vues_boutique integer DEFAULT 0,
    nb_vues_produits integer DEFAULT 0,
    nb_clics_whatsapp integer DEFAULT 0,
    nb_appels integer DEFAULT 0,
    total_recettes_app numeric(12,2) DEFAULT 0.00
);


--
-- Name: utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilisateurs (
    id integer NOT NULL,
    nom character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    telephone character varying(20) NOT NULL,
    mot_de_passe character varying(255) NOT NULL,
    role public.role_utilisateur DEFAULT 'CLIENT'::public.role_utilisateur NOT NULL,
    date_inscription timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: utilisateurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.utilisateurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: utilisateurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.utilisateurs_id_seq OWNED BY public.utilisateurs.id;


--
-- Name: vendeurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendeurs (
    utilisateur_id integer NOT NULL,
    est_abonne boolean DEFAULT false,
    date_fin_abonnement timestamp with time zone
);


--
-- Name: avis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis ALTER COLUMN id SET DEFAULT nextval('public.avis_id_seq'::regclass);


--
-- Name: boutiques id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques ALTER COLUMN id SET DEFAULT nextval('public.boutiques_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: commandes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes ALTER COLUMN id SET DEFAULT nextval('public.commandes_id_seq'::regclass);


--
-- Name: discussions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions ALTER COLUMN id SET DEFAULT nextval('public.discussions_id_seq'::regclass);


--
-- Name: lignes_de_commande id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_de_commande ALTER COLUMN id SET DEFAULT nextval('public.lignes_de_commande_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: paniers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paniers ALTER COLUMN id SET DEFAULT nextval('public.paniers_id_seq'::regclass);


--
-- Name: produits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produits ALTER COLUMN id SET DEFAULT nextval('public.produits_id_seq'::regclass);


--
-- Name: utilisateurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs ALTER COLUMN id SET DEFAULT nextval('public.utilisateurs_id_seq'::regclass);


--
-- Data for Name: avis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.avis (id, client_id, boutique_id, note, commentaire, date_avis) FROM stdin;
\.


--
-- Data for Name: boutiques; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.boutiques (id, vendeur_id, nom_boutique, logo, description, quartier, point_repere, latitude, longitude, contact_whatsapp, statut, horaire_ouverture, est_ouvert, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, nom, icone) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (utilisateur_id, adresse_residence, latitude, longitude) FROM stdin;
\.


--
-- Data for Name: commandes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commandes (id, code_commande, client_id, date_commande, date_livraison_prevue, lieu_livraison, statut, montant_total, updated_at) FROM stdin;
\.


--
-- Data for Name: discussions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discussions (id, client_id, vendeur_id, date_creation) FROM stdin;
\.


--
-- Data for Name: lignes_de_commande; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lignes_de_commande (id, commande_id, panier_id, produit_id, quantite, prix_unitaire) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, discussion_id, expediteur_id, contenu, horodatage, est_lu) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, utilisateur_id, type, titre, message, est_lue, lien_action, created_at) FROM stdin;
\.


--
-- Data for Name: paniers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.paniers (id, client_id, montant_total, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: produits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.produits (id, boutique_id, categorie_id, nom, description, prix, photos, disponible, statut_stock, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: statistiques_vendeurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.statistiques_vendeurs (boutique_id, nb_vues_boutique, nb_vues_produits, nb_clics_whatsapp, nb_appels, total_recettes_app) FROM stdin;
\.


--
-- Data for Name: utilisateurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.utilisateurs (id, nom, email, telephone, mot_de_passe, role, date_inscription, updated_at) FROM stdin;
\.


--
-- Data for Name: vendeurs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vendeurs (utilisateur_id, est_abonne, date_fin_abonnement) FROM stdin;
\.


--
-- Name: avis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.avis_id_seq', 1, false);


--
-- Name: boutiques_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.boutiques_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 1, false);


--
-- Name: commandes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commandes_id_seq', 1, false);


--
-- Name: discussions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.discussions_id_seq', 1, false);


--
-- Name: lignes_de_commande_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lignes_de_commande_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: paniers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.paniers_id_seq', 1, false);


--
-- Name: produits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.produits_id_seq', 1, false);


--
-- Name: utilisateurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.utilisateurs_id_seq', 1, false);


--
-- Name: avis avis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis
    ADD CONSTRAINT avis_pkey PRIMARY KEY (id);


--
-- Name: boutiques boutiques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_pkey PRIMARY KEY (id);


--
-- Name: boutiques boutiques_vendeur_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_vendeur_id_key UNIQUE (vendeur_id);


--
-- Name: categories categories_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_nom_key UNIQUE (nom);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (utilisateur_id);


--
-- Name: commandes commandes_code_commande_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_code_commande_key UNIQUE (code_commande);


--
-- Name: commandes commandes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_pkey PRIMARY KEY (id);


--
-- Name: discussions discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_pkey PRIMARY KEY (id);


--
-- Name: lignes_de_commande lignes_de_commande_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_de_commande
    ADD CONSTRAINT lignes_de_commande_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: paniers paniers_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paniers
    ADD CONSTRAINT paniers_client_id_key UNIQUE (client_id);


--
-- Name: paniers paniers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paniers
    ADD CONSTRAINT paniers_pkey PRIMARY KEY (id);


--
-- Name: produits produits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produits
    ADD CONSTRAINT produits_pkey PRIMARY KEY (id);


--
-- Name: statistiques_vendeurs statistiques_vendeurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statistiques_vendeurs
    ADD CONSTRAINT statistiques_vendeurs_pkey PRIMARY KEY (boutique_id);


--
-- Name: discussions unique_discussion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT unique_discussion UNIQUE (client_id, vendeur_id);


--
-- Name: utilisateurs utilisateurs_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_email_key UNIQUE (email);


--
-- Name: utilisateurs utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: utilisateurs utilisateurs_telephone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_telephone_key UNIQUE (telephone);


--
-- Name: vendeurs vendeurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendeurs
    ADD CONSTRAINT vendeurs_pkey PRIMARY KEY (utilisateur_id);


--
-- Name: idx_boutiques_coords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boutiques_coords ON public.boutiques USING btree (latitude, longitude);


--
-- Name: idx_notifications_utilisateur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_utilisateur ON public.notifications USING btree (utilisateur_id, est_lue);


--
-- Name: boutiques trg_create_boutique_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_boutique_stats AFTER INSERT ON public.boutiques FOR EACH ROW EXECUTE FUNCTION public.create_boutique_stats();


--
-- Name: avis avis_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis
    ADD CONSTRAINT avis_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: avis avis_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avis
    ADD CONSTRAINT avis_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(utilisateur_id) ON DELETE CASCADE;


--
-- Name: boutiques boutiques_vendeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_vendeur_id_fkey FOREIGN KEY (vendeur_id) REFERENCES public.vendeurs(utilisateur_id) ON DELETE CASCADE;


--
-- Name: clients clients_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- Name: commandes commandes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes
    ADD CONSTRAINT commandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(utilisateur_id) ON DELETE CASCADE;


--
-- Name: discussions discussions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(utilisateur_id) ON DELETE CASCADE;


--
-- Name: discussions discussions_vendeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_vendeur_id_fkey FOREIGN KEY (vendeur_id) REFERENCES public.vendeurs(utilisateur_id) ON DELETE CASCADE;


--
-- Name: lignes_de_commande lignes_de_commande_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_de_commande
    ADD CONSTRAINT lignes_de_commande_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes(id) ON DELETE CASCADE;


--
-- Name: lignes_de_commande lignes_de_commande_panier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_de_commande
    ADD CONSTRAINT lignes_de_commande_panier_id_fkey FOREIGN KEY (panier_id) REFERENCES public.paniers(id) ON DELETE CASCADE;


--
-- Name: lignes_de_commande lignes_de_commande_produit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_de_commande
    ADD CONSTRAINT lignes_de_commande_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id) ON DELETE RESTRICT;


--
-- Name: messages messages_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_discussion_id_fkey FOREIGN KEY (discussion_id) REFERENCES public.discussions(id) ON DELETE CASCADE;


--
-- Name: messages messages_expediteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_expediteur_id_fkey FOREIGN KEY (expediteur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- Name: paniers paniers_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paniers
    ADD CONSTRAINT paniers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(utilisateur_id) ON DELETE CASCADE;


--
-- Name: produits produits_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produits
    ADD CONSTRAINT produits_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: produits produits_categorie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produits
    ADD CONSTRAINT produits_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: statistiques_vendeurs statistiques_vendeurs_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statistiques_vendeurs
    ADD CONSTRAINT statistiques_vendeurs_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: vendeurs vendeurs_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendeurs
    ADD CONSTRAINT vendeurs_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Mx1foTMhqxmCt1Ck5cDTdEKsU5Tf2eryKDEi6kjrZwjFqXLladSIbfVNeXPaVS0

