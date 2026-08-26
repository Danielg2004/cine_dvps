CREATE TABLE IF NOT EXISTS peliculas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    duracion INT NOT NULL,
    genero VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL,
    capacidad INT NOT NULL,
    hora_de_inicio TIME NOT NULL,
    pelicula_id INT NOT NULL,

    CONSTRAINT fk_salas_peliculas
        FOREIGN KEY (pelicula_id)
        REFERENCES peliculas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pelicula_id INT NOT NULL,
    sala_id INT NOT NULL,
    cantidad_de_entradas INT NOT NULL,
    precio_total DECIMAL(10,2) NOT NULL,
    nombre_cliente VARCHAR(255) NOT NULL,
    fecha_reserva DATE NOT NULL,
    hora_reserva TIME NOT NULL,

    CONSTRAINT fk_reservas_peliculas
        FOREIGN KEY (pelicula_id)
        REFERENCES peliculas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_reservas_salas
        FOREIGN KEY (sala_id)
        REFERENCES salas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);